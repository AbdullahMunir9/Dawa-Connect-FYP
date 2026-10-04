import 'dotenv/config'
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { randomUUID } from 'crypto'
import { io } from 'socket.io-client'
import { configureLocationPermissions, isLocationRequester } from './locationPermissions.mjs'
import { createLocationService } from './locationSearch.mjs'
import {
  initDatabase,
  registerUser,
  checkRegistrationAvailability,
  loginUser,
  restoreUserSession,
  logoutUser,
  requestPasswordReset,
  resetPasswordWithOtp,
  listProducts,
  createProduct,
  updateProduct,
  removeProduct,
  listCollection,
  createCollectionItem,
  updateCollectionItem,
  removeCollectionItem,
  getProfile,
  upsertProfile,
  listComplaints,
  createComplaint,
  replyComplaint,
  updateComplaintStatus
} from './db.js'

const isDev = !app.isPackaged
const locationService = createLocationService()
const chatServiceUrl = String(process.env.CHAT_SERVICE_URL || 'http://localhost:5000').replace(/\/$/, '')
let chatSocket = null
let chatSessionToken = ''
let chatTokenRefreshTimer = null

function broadcastChatEvent(type, data) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('chat:event', { type, data })
  }
}

async function requestPharmacyChatToken(sessionToken) {
  const response = await fetch(`${chatServiceUrl}/api/chat/auth/pharmacy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken })
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.token) throw new Error(data.message || 'Could not authenticate with live chat.')
  return data.token
}

function disconnectPharmacyChat() {
  if (chatTokenRefreshTimer) clearInterval(chatTokenRefreshTimer)
  chatTokenRefreshTimer = null
  chatSocket?.removeAllListeners()
  chatSocket?.disconnect()
  chatSocket = null
  chatSessionToken = ''
}

async function connectPharmacyChat(sessionToken) {
  const normalizedToken = String(sessionToken || '').trim()
  if (!normalizedToken) throw new Error('Your pharmacy session is missing. Sign in again.')
  if (chatSocket?.connected && chatSessionToken === normalizedToken) return { connected: true, serviceUrl: chatServiceUrl }

  disconnectPharmacyChat()
  chatSessionToken = normalizedToken
  const token = await requestPharmacyChatToken(normalizedToken)
  const socket = io(chatServiceUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 20
  })
  chatSocket = socket

  socket.on('connect', () => broadcastChatEvent('connection', { state: 'connected' }))
  socket.on('disconnect', () => broadcastChatEvent('connection', { state: 'reconnecting' }))
  socket.on('connect_error', (error) => broadcastChatEvent('connection', { state: 'offline', error: error.message }))
  socket.on('message:new', (data) => broadcastChatEvent('message:new', data))
  socket.on('conversation:updated', (data) => broadcastChatEvent('conversation:updated', data))

  chatTokenRefreshTimer = setInterval(async () => {
    try {
      const refreshedToken = await requestPharmacyChatToken(chatSessionToken)
      if (chatSocket) chatSocket.auth = { token: refreshedToken }
    } catch (error) {
      broadcastChatEvent('connection', { state: 'offline', error: error.message })
    }
  }, 12 * 60 * 1000)

  if (socket.connected) return { connected: true, serviceUrl: chatServiceUrl }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Live chat connection timed out.')), 12_000)
    socket.once('connect', () => {
      clearTimeout(timeout)
      resolve({ connected: true, serviceUrl: chatServiceUrl })
    })
    socket.once('connect_error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

function emitChatEvent(event, payload = {}) {
  if (!chatSocket?.connected) return Promise.reject(new Error('Live chat is offline. Reconnect and try again.'))
  return new Promise((resolve, reject) => {
    chatSocket.timeout(12_000).emit(event, payload, (timeoutError, response) => {
      if (timeoutError) return reject(new Error('The chat service did not respond.'))
      if (!response?.ok) return reject(Object.assign(new Error(response?.error || 'Chat request failed.'), { code: response?.code }))
      return resolve(response.data)
    })
  })
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const rendererUrl = isDev && process.env.ELECTRON_RENDERER_URL
    ? process.env.ELECTRON_RENDERER_URL
    : pathToFileURL(join(__dirname, '../renderer/index.html')).href
  configureLocationPermissions(mainWindow, dialog, rendererUrl)
  // Return readiness only; never send the API key to the renderer.
  mainWindow.webContents.ipc.handle('location:available', () => Boolean(process.env.GEOAPIFY_API_KEY?.trim()))
  for (const action of ['search', 'confirm']) {
    mainWindow.webContents.ipc.handle(`location:${action}`, async (event, payload) => {
      try {
        if (!isLocationRequester(mainWindow, event.sender, {
          isMainFrame: event.senderFrame === mainWindow.webContents.mainFrame,
          requestingUrl: event.senderFrame?.url
        }, rendererUrl)) throw new Error('Location requests must come from the main application page.')
        const data = await locationService[action](event.sender.id, payload)
        return { ok: true, data }
      } catch (error) {
        return { ok: false, error: error.message }
      }
    })
  }
  const contentsId = mainWindow.webContents.id
  mainWindow.on('closed', () => locationService.clear(contentsId))

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  initDatabase().catch((error) => {
    console.error('MongoDB init failed:', error.message)
  })

  ipcMain.handle('auth:register', async (event, payload) => {
    try {
      const user = await registerUser(locationService.registrationPayload(event.sender.id, payload))
      locationService.clear(event.sender.id)
      return { ok: true, data: user }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('auth:registration-availability', async (_event, payload) => {
    try {
      const data = await checkRegistrationAvailability(payload || {})
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('auth:login', async (_event, payload) => {
    try {
      const user = await loginUser(payload)
      return { ok: true, data: user }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('auth:restore', async (_event, payload) => {
    try {
      const user = await restoreUserSession(payload || {})
      return { ok: true, data: user }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('auth:logout', async (_event, payload) => {
    try {
      const data = await logoutUser(payload || {})
      disconnectPharmacyChat()
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('auth:forgot-request', async (_event, payload) => {
    try {
      const data = await requestPasswordReset(payload?.email || '')
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('auth:forgot-reset', async (_event, payload) => {
    try {
      const data = await resetPasswordWithOtp(payload)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('products:list', async (_event, payload) => {
    try {
      const data = await listProducts(payload?.ownerId)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('products:create', async (_event, payload) => {
    try {
      const data = await createProduct(payload.ownerId, payload.product)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('products:update', async (_event, payload) => {
    try {
      const data = await updateProduct(payload.ownerId, payload.product)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('products:remove', async (_event, payload) => {
    try {
      const data = await removeProduct(payload.ownerId, payload.id)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('entity:list', async (_event, payload) => {
    try {
      const data = await listCollection(payload.entity, payload.ownerId, payload.sort || { createdAt: -1 })
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('entity:create', async (_event, payload) => {
    try {
      const data = await createCollectionItem(payload.entity, payload.ownerId, payload.item)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('entity:update', async (_event, payload) => {
    try {
      const data = await updateCollectionItem(payload.entity, payload.ownerId, payload.id, payload.updates)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('entity:remove', async (_event, payload) => {
    try {
      const data = await removeCollectionItem(payload.entity, payload.ownerId, payload.id)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('profile:get', async (_event, payload) => {
    try {
      const data = await getProfile(payload.ownerId)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('profile:save', async (_event, payload) => {
    try {
      const data = await upsertProfile(payload.ownerId, payload.profile)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('complaints:list', async (_event, payload) => {
    try {
      const data = await listComplaints(payload.ownerId)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('complaints:create', async (_event, payload) => {
    try {
      const data = await createComplaint(payload.ownerId, payload.complaint)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('complaints:reply', async (_event, payload) => {
    try {
      const data = await replyComplaint(payload.ownerId, payload.id, payload.text)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('complaints:update-status', async (_event, payload) => {
    try {
      const data = await updateComplaintStatus(payload.ownerId, payload.id, payload.status, payload.note)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('chat:connect', async (_event, payload) => {
    try {
      return { ok: true, data: await connectPharmacyChat(payload?.sessionToken) }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('chat:list-conversations', async () => {
    try {
      return { ok: true, data: await emitChatEvent('conversation:list') }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('chat:join', async (_event, payload) => {
    try {
      return { ok: true, data: await emitChatEvent('conversation:join', { conversationId: payload?.conversationId }) }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('chat:list-messages', async (_event, payload) => {
    try {
      return { ok: true, data: await emitChatEvent('message:history', { conversationId: payload?.conversationId, before: payload?.before, limit: payload?.limit || 50 }) }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('chat:send-message', async (_event, payload) => {
    try {
      const data = await emitChatEvent('message:send', {
        conversationId: payload?.conversationId,
        text: payload?.text,
        clientMessageId: randomUUID()
      })
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('chat:mark-read', async (_event, payload) => {
    try {
      return { ok: true, data: await emitChatEvent('message:read', { conversationId: payload?.conversationId }) }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  disconnectPharmacyChat()
  if (process.platform !== 'darwin') app.quit()
})
