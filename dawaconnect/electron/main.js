import 'dotenv/config'
import { app, BrowserWindow, shell, ipcMain, dialog, safeStorage } from 'electron'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { randomUUID } from 'crypto'
import { io } from 'socket.io-client'
import { configureLocationPermissions, isLocationRequester } from './locationPermissions.mjs'
import {
  registerUser,
  verifyRegistration,
  resendRegistrationOtp,
  uploadRegistrationPhoto,
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
  uploadProfilePhoto,
  removeProfilePhoto,
  listComplaints,
  createComplaint,
  replyComplaint,
  updateComplaintStatus,
  locationAvailable,
  searchPharmacyLocation,
  confirmPharmacyLocation,
  getSessionToken,
  pharmacyApiOrigin
} from './api.js'

const isDev = !app.isPackaged
const chatServiceUrl = pharmacyApiOrigin
let chatSocket = null
let chatSessionToken = ''
let chatTokenRefreshTimer = null
const registrationPhotoSelections = new Map()

function pharmacyPhotoMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  return ''
}

function validatedPhotoSlot(value) {
  const slot = String(value || '').toLowerCase()
  if (!['inside', 'outside'].includes(slot)) throw new Error('Photo type must be inside or outside.')
  return slot
}

async function choosePharmacyPhoto() {
  const options = {
    title: 'Choose pharmacy photo',
    properties: ['openFile'],
    filters: [{ name: 'Photos', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
  }
  const focusedWindow = BrowserWindow.getFocusedWindow()
  const result = focusedWindow ? await dialog.showOpenDialog(focusedWindow, options) : await dialog.showOpenDialog(options)
  if (result.canceled || !result.filePaths[0]) return null
  const filePath = result.filePaths[0]
  const buffer = await readFile(filePath)
  if (buffer.length > 5 * 1024 * 1024) throw new Error('Each pharmacy photo must be 5 MB or smaller.')
  const mimeType = pharmacyPhotoMime(buffer)
  if (!mimeType) throw new Error('Only JPEG, PNG, and WebP pharmacy photos are supported.')
  return { filePath, buffer, mimeType, previewUrl: `data:${mimeType};base64,${buffer.toString('base64')}` }
}

function sessionFilePath() {
  return join(app.getPath('userData'), 'pharmacy-session.bin')
}

async function savePharmacySession(token) {
  if (!safeStorage.isEncryptionAvailable()) return
  await writeFile(sessionFilePath(), safeStorage.encryptString(String(token || '')))
}

async function loadPharmacySession() {
  if (!safeStorage.isEncryptionAvailable()) return ''
  try {
    return safeStorage.decryptString(await readFile(sessionFilePath()))
  } catch {
    return ''
  }
}

async function clearPharmacySession() {
  await unlink(sessionFilePath()).catch(() => {})
}

function withoutSessionToken(user) {
  if (!user || typeof user !== 'object') return user
  const { sessionToken: _sessionToken, ...view } = user
  return view
}

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
  mainWindow.webContents.ipc.handle('location:available', async () => locationAvailable().catch(() => false))
  for (const action of ['search', 'confirm']) {
    mainWindow.webContents.ipc.handle(`location:${action}`, async (event, payload) => {
      try {
        if (!isLocationRequester(mainWindow, event.sender, {
          isMainFrame: event.senderFrame === mainWindow.webContents.mainFrame,
          requestingUrl: event.senderFrame?.url
        }, rendererUrl)) throw new Error('Location requests must come from the main application page.')
        const data = action === 'search'
          ? await searchPharmacyLocation(payload)
          : await confirmPharmacyLocation(payload)
        return { ok: true, data }
      } catch (error) {
        return { ok: false, error: error.message }
      }
    })
  }
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('auth:register', async (_event, payload) => {
    try {
      const user = await registerUser(payload)
      return { ok: true, data: user }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('auth:register-verify', async (_event, payload) => {
    try {
      const data = await verifyRegistration(payload)
      const { photoUploadToken, ...safeData } = data
      const photoUploadErrors = []
      if (registrationPhotoSelections.size > 0 && !photoUploadToken) {
        photoUploadErrors.push('The server did not provide a photo upload session.')
      } else if (photoUploadToken) {
        for (const [slot, photo] of registrationPhotoSelections.entries()) {
          try {
            await uploadRegistrationPhoto(slot, photo.buffer, photo.mimeType, photoUploadToken)
          } catch (error) {
            photoUploadErrors.push(`${slot}: ${error.message}`)
          }
        }
      }
      registrationPhotoSelections.clear()
      return {
        ok: true,
        data: {
          ...safeData,
          photoUploadWarning: photoUploadErrors.length
            ? 'Your account was created, but one or more optional photos could not be uploaded. Add them later from Pharmacy Profile.'
            : ''
        }
      }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('photos:registration-pick', async (_event, payload) => {
    try {
      const slot = validatedPhotoSlot(payload?.slot)
      const photo = await choosePharmacyPhoto()
      if (!photo) return { ok: true, canceled: true }
      registrationPhotoSelections.set(slot, photo)
      return { ok: true, data: { slot, previewUrl: photo.previewUrl, size: photo.buffer.length } }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('photos:registration-clear', async (_event, payload) => {
    try {
      registrationPhotoSelections.delete(validatedPhotoSlot(payload?.slot))
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('auth:register-resend', async (_event, payload) => {
    try {
      const data = await resendRegistrationOtp(payload?.challengeId)
      return { ok: true, data }
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
      await savePharmacySession(user.sessionToken)
      return { ok: true, data: withoutSessionToken(user) }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('auth:restore', async () => {
    try {
      const sessionToken = await loadPharmacySession()
      if (!sessionToken) throw new Error('No saved pharmacy session.')
      const user = await restoreUserSession({ sessionToken })
      return { ok: true, data: withoutSessionToken(user) }
    } catch (error) {
      await clearPharmacySession()
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('auth:logout', async () => {
    try {
      const data = await logoutUser()
      disconnectPharmacyChat()
      await clearPharmacySession()
      return { ok: true, data }
    } catch (error) {
      await clearPharmacySession()
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

  ipcMain.handle('profile:photo-upload', async (_event, payload) => {
    try {
      const slot = validatedPhotoSlot(payload?.slot)
      const photo = await choosePharmacyPhoto()
      if (!photo) return { ok: true, canceled: true }
      const data = await uploadProfilePhoto(slot, photo.buffer, photo.mimeType)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('profile:photo-remove', async (_event, payload) => {
    try {
      const data = await removeProfilePhoto(validatedPhotoSlot(payload?.slot))
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
      return { ok: true, data: await connectPharmacyChat(payload?.sessionToken || getSessionToken()) }
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
