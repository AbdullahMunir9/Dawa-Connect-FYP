import 'dotenv/config'
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
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
  syncChatThreadsFromOrders,
  listChatMessages,
  createChatMessage,
  logChatAi,
  listChatAiLogs,
  listComplaints,
  createComplaint,
  replyComplaint,
  updateComplaintStatus
} from './db.js'

const isDev = !app.isPackaged
const locationService = createLocationService()

async function generateChatReply({ question, inventory = [], orders = [], pharmacyProfile = {}, history = [] }) {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions'
  const safeHistory = Array.isArray(history) ? history.slice(-10) : []

  if (!apiKey) {
    const lowStock = inventory.filter((item) => Number(item.stock || 0) <= Number(item.threshold || 0)).slice(0, 3)
    if (/low stock|stock/i.test(question) && lowStock.length) {
      return `Low stock items: ${lowStock.map((i) => `${i.name} (${i.stock})`).join(', ')}.`
    }
    if (/order|pending|delivery/i.test(question)) {
      const pending = orders.filter((o) => o.status === 'Pending').length
      const delivered = orders.filter((o) => o.status === 'Delivered').length
      return `You currently have ${pending} pending orders and ${delivered} delivered orders. Add OPENAI_API_KEY in .env for fully AI-powered answers.`
    }
    return 'I can answer basic pharmacy data questions now. For full AI answers to any question, set OPENAI_API_KEY in your .env and restart the app.'
  }

  const systemPrompt = [
    'You are DawaConnect live pharmacy assistant for business users.',
    'Answer clearly and concisely.',
    'Use provided pharmacy data when relevant.',
    'If asked medical diagnosis, refuse and suggest consulting a licensed doctor.',
    'If uncertain, say what extra data is needed.',
    'Never provide dangerous, illegal, or harmful instructions.'
  ].join(' ')

  const contextPayload = {
    pharmacyProfile: {
      name: pharmacyProfile?.name,
      status: pharmacyProfile?.status,
      deliveryCharge: pharmacyProfile?.deliveryCharge
    },
    inventory: inventory.slice(0, 200),
    orders: orders.slice(0, 200)
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: `Context JSON: ${JSON.stringify(contextPayload)}` },
    ...safeHistory.map((item) => ({
      role: item.from === 'assistant' ? 'assistant' : 'user',
      content: item.text
    })),
    { role: 'user', content: question }
  ]

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, messages, temperature: 0.3 })
  })

  if (!response.ok) {
    const raw = await response.text()
    throw new Error(`AI request failed: ${response.status} ${raw}`)
  }
  const json = await response.json()
  return json?.choices?.[0]?.message?.content?.trim() || 'I could not generate a response. Please try again.'
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

  ipcMain.handle('chat:ask', async (_event, payload) => {
    const startedAt = Date.now()
    try {
      const question = payload?.question || ''
      if (/suicide|self harm|bomb|weapon|kill|poison/i.test(question)) {
        const blocked = 'I cannot help with harmful requests. I can help with pharmacy operations, order management, inventory, and customer support.'
        await logChatAi(payload.ownerId, {
          threadId: payload.threadId || '',
          question,
          response: blocked,
          blocked: true,
          latencyMs: Date.now() - startedAt
        })
        return { ok: true, data: { reply: blocked } }
      }

      const data = await generateChatReply(payload)
      await logChatAi(payload.ownerId, {
        threadId: payload.threadId || '',
        question,
        response: data,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        latencyMs: Date.now() - startedAt,
        blocked: false
      })
      return { ok: true, data: { reply: data } }
    } catch (error) {
      await logChatAi(payload.ownerId, {
        threadId: payload.threadId || '',
        question: payload?.question || '',
        error: error.message,
        latencyMs: Date.now() - startedAt,
        blocked: false
      })
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('chat:sync-threads', async (_event, payload) => {
    try {
      const data = await syncChatThreadsFromOrders(payload.ownerId)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('chat:list-messages', async (_event, payload) => {
    try {
      const data = await listChatMessages(payload.ownerId, payload.threadId)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('chat:send-message', async (_event, payload) => {
    try {
      const data = await createChatMessage(payload.ownerId, payload.threadId, payload.message)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('chat:logs', async (_event, payload) => {
    try {
      const data = await listChatAiLogs(payload.ownerId, payload.limit || 30)
      return { ok: true, data }
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
  if (process.platform !== 'darwin') app.quit()
})
