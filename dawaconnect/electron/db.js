import { MongoClient, ObjectId } from 'mongodb'
import bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'
import { randomBytes } from 'crypto'

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.PHARMACY_DB_NAME || 'Pharmacy'
const MARKETPLACE_DB_NAME = process.env.MARKETPLACE_DB_NAME || 'MarketPlace'

let client
let db
let mailTransporter

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Set MONGODB_URI and restart the app.')
  }
  return db
}

export async function initDatabase() {
  if (db) return db
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI environment variable')
  }

  client = new MongoClient(MONGODB_URI)
  await client.connect()
  db = client.db(DB_NAME)

  await db.collection('users').createIndex({ email: 1 }, { unique: true })
  await db.collection('users').createIndex({ phoneNormalized: 1 }, { unique: true, sparse: true })
  await db.collection('users').createIndex({ location: '2dsphere' })
  await db.collection('products').createIndex({ ownerId: 1, name: 1 })
  await db.collection('orders').createIndex({ ownerId: 1, date: -1 })
  await db.collection('orders').createIndex({ marketplaceOrderId: 1, ownerId: 1 })
  await db.collection('staff').createIndex({ ownerId: 1, email: 1 })
  await db.collection('reviews').createIndex({ ownerId: 1, date: -1 })
  await db.collection('returns').createIndex({ ownerId: 1, date: -1 })
  await db.collection('notifications').createIndex({ ownerId: 1, createdAt: -1 })
  await db.collection('profiles').createIndex({ ownerId: 1 }, { unique: true })
  await db.collection('profiles').createIndex({ location: '2dsphere' })
  await db.collection('chat_threads').createIndex({ ownerId: 1, updatedAt: -1 })
  await db.collection('chat_messages').createIndex({ ownerId: 1, threadId: 1, createdAt: 1 })
  await db.collection('chat_ai_logs').createIndex({ ownerId: 1, createdAt: -1 })
  await db.collection('sessions').createIndex({ token: 1 }, { unique: true })
  await db.collection('sessions').createIndex({ userId: 1, revokedAt: 1, expiresAt: 1 })
  await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  }
  return db
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11)
}

function assertStrongPassword(pw) {
  if (!pw || pw.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }
  if (!/[A-Z]/.test(pw)) {
    throw new Error('Password must include at least one uppercase letter')
  }
  if (!/[^A-Za-z0-9]/.test(pw)) {
    throw new Error('Password must include at least one special character')
  }
}

function normalizePharmacyCoordinates(payload) {
  if (payload?.latitude === null || payload?.latitude === '' || payload?.latitude === undefined) {
    throw new Error('Select the pharmacy location on the map')
  }
  if (payload?.longitude === null || payload?.longitude === '' || payload?.longitude === undefined) {
    throw new Error('Select the pharmacy location on the map')
  }
  const latitude = Number(payload.latitude)
  const longitude = Number(payload.longitude)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Pharmacy latitude must be between -90 and 90')
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Pharmacy longitude must be between -180 and 180')
  }
  return {
    latitude,
    longitude,
    location: { type: 'Point', coordinates: [longitude, latitude] }
  }
}

async function isPhoneTaken(phoneDigits) {
  if (!phoneDigits || phoneDigits.length !== 11) return false
  const users = getDb().collection('users')
  const indexed = await users.findOne({
    $or: [{ phoneNormalized: phoneDigits }, { phone: phoneDigits }]
  })
  if (indexed) return true
  const legacy = await users.find(
    { phoneNormalized: { $exists: false } },
    { projection: { phone: 1 } }
  ).toArray()
  return legacy.some((u) => normalizePhoneDigits(u.phone) === phoneDigits)
}

export async function checkRegistrationAvailability({ email, phone }) {
  const users = getDb().collection('users')
  const emailNorm = String(email || '').trim().toLowerCase()
  const phoneDigits = normalizePhoneDigits(phone)
  const result = { emailTaken: false, phoneTaken: false }
  if (emailNorm.includes('@')) {
    result.emailTaken = !!(await users.findOne({ email: emailNorm }))
  }
  if (phoneDigits.length === 11) {
    result.phoneTaken = await isPhoneTaken(phoneDigits)
  }
  return result
}

export async function registerUser(payload) {
  const users = getDb().collection('users')
  const emailNorm = String(payload.email || '').trim().toLowerCase()
  const existing = await users.findOne({ email: emailNorm })
  if (existing) {
    throw new Error('Email is already registered')
  }

  const phoneNormalized = normalizePhoneDigits(payload.phone)
  if (phoneNormalized.length !== 11) {
    throw new Error('Phone number must be exactly 11 digits')
  }
  if (await isPhoneTaken(phoneNormalized)) {
    throw new Error('Phone number is already registered')
  }

  assertStrongPassword(payload.password)
  const coordinates = normalizePharmacyCoordinates(payload)

  const cnicDigits = String(payload.cnic || '').replace(/\D/g, '')
  if (cnicDigits.length !== 13) {
    throw new Error('Owner CNIC must be 13 digits')
  }

  const passwordHash = await bcrypt.hash(payload.password, 10)
  const now = new Date()
  const doc = {
    ...payload,
    ...coordinates,
    email: emailNorm,
    phone: phoneNormalized,
    phoneNormalized,
    status: 'unapproved',
    approvalStatus: 'unapproved',
    passwordHash,
    createdAt: now,
    updatedAt: now
  }
  delete doc.password
  delete doc.confirmPassword

  const result = await users.insertOne(doc)
  const seedPayload = { ...payload, email: emailNorm, phone: phoneNormalized }
  await seedInitialData(result.insertedId.toString(), seedPayload)
  return {
    id: result.insertedId.toString(),
    name: payload.ownerName,
    role: 'Admin',
    email: emailNorm,
    pharmacyName: payload.pharmacyName
  }
}

async function seedInitialData(ownerId, payload) {
  const now = new Date()
  const coordinates = normalizePharmacyCoordinates(payload)
  const profile = {
    ownerId,
    name: payload.pharmacyName,
    address: payload.addressLine1,
    phone: payload.phone,
    email: payload.email,
    license: payload.licenseNumber,
    hours: `${payload.openingTime || '08:00'} - ${payload.closingTime || '22:00'}`,
    deliveryCharge: Number(payload.deliveryCharge || 50),
    deliveryRadius: Number(payload.serviceRadiusKm || 10),
    ...coordinates,
    status: 'Open',
    approvalStatus: 'unapproved',
    logo: '💊',
    taxRate: 5,
    bankName: 'HBL',
    accountNo: '',
    createdAt: now,
    updatedAt: now
  }
  await getDb().collection('profiles').updateOne({ ownerId }, { $set: profile }, { upsert: true })

  await getDb().collection('notifications').insertMany([
    { ownerId, type: 'order', message: 'Welcome! Your pharmacy account is active.', read: false, color: '#14b8a6', createdAt: now, updatedAt: now }
  ])

  const chatThread = await getDb().collection('chat_threads').insertOne({
    ownerId,
    customerName: 'Live Assistant',
    status: 'open',
    unread: 0,
    lastMessage: 'Ask me anything about your pharmacy operations.',
    updatedAt: now,
    createdAt: now
  })
  await getDb().collection('chat_messages').insertOne({
    ownerId,
    threadId: chatThread.insertedId.toString(),
    from: 'assistant',
    text: 'Hello! I am your live pharmacy assistant. Ask me about stock, orders, analytics, or customer support replies.',
    createdAt: now,
    updatedAt: now
  })
}

function mapUserSessionView(user) {
  return {
    id: user._id.toString(),
    name: user.ownerName,
    role: 'Admin',
    email: user.email,
    pharmacyName: user.pharmacyName,
    status: user.status,
    approvalStatus: user.approvalStatus,
    accountStatus: String(user.status || '').toLowerCase(),
    rejectionReason: user.rejectionReason || '',
    suspensionReason: user.suspensionReason || ''
  }
}

async function createSession(userId) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const token = randomBytes(48).toString('hex')
  await getDb().collection('sessions').insertOne({
    token,
    userId,
    createdAt: now,
    updatedAt: now,
    expiresAt,
    revokedAt: null
  })
  return token
}

export async function loginUser({ email, password }) {
  const users = getDb().collection('users')
  const user = await users.findOne({ email: email.toLowerCase() })
  if (!user) throw new Error('Invalid email or password')

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) throw new Error('Invalid email or password')

  const sessionToken = await createSession(user._id.toString())
  return { ...mapUserSessionView(user), sessionToken }
}

export async function restoreUserSession({ sessionToken }) {
  if (!sessionToken) throw new Error('Missing session token')
  const sessions = getDb().collection('sessions')
  const session = await sessions.findOne({ token: sessionToken, revokedAt: null })
  if (!session) throw new Error('Session not found')
  if (session.expiresAt && session.expiresAt < new Date()) throw new Error('Session expired')

  const users = getDb().collection('users')
  const user = await users.findOne({ _id: new ObjectId(session.userId) })
  if (!user) throw new Error('User not found')

  await sessions.updateOne({ _id: session._id }, { $set: { updatedAt: new Date() } })
  return { ...mapUserSessionView(user), sessionToken }
}

export async function logoutUser({ sessionToken, userId }) {
  const now = new Date()
  if (sessionToken) {
    await getDb().collection('sessions').updateOne(
      { token: sessionToken, revokedAt: null },
      { $set: { revokedAt: now, updatedAt: now } }
    )
    return { ok: true }
  }
  if (userId) {
    await getDb().collection('sessions').updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: now, updatedAt: now } }
    )
  }
  return { ok: true }
}

export async function listProducts(ownerId) {
  const products = getDb().collection('products')
  const docs = await products.find({ ownerId }).sort({ createdAt: -1 }).toArray()
  return docs.map((doc) => ({ ...doc, _id: doc._id.toString() }))
}

export async function createProduct(ownerId, payload) {
  const products = getDb().collection('products')
  const now = new Date()
  const doc = { ...payload, ownerId, createdAt: now, updatedAt: now }
  const result = await products.insertOne(doc)
  return { ...doc, _id: result.insertedId.toString() }
}

export async function updateProduct(ownerId, payload) {
  const products = getDb().collection('products')
  const { id, ...rest } = payload
  const skip = new Set(['_id', 'id', 'ownerId', 'createdAt', 'updatedAt'])
  const updates = Object.fromEntries(
    Object.entries(rest).filter(([k, v]) => !skip.has(k) && v !== undefined)
  )
  const _id = new ObjectId(id)
  const res = await products.updateOne(
    { _id, ownerId },
    { $set: { ...updates, updatedAt: new Date() } }
  )
  if (res.matchedCount === 0) {
    throw new Error('Product not found or access denied')
  }
  const doc = await products.findOne({ _id, ownerId })
  return doc ? { ...doc, _id: doc._id.toString() } : null
}

export async function removeProduct(ownerId, id) {
  const products = getDb().collection('products')
  const _id = new ObjectId(id)
  await products.deleteOne({ _id, ownerId })
  return { success: true }
}

function mapDoc(doc) {
  return { ...doc, _id: doc._id.toString(), id: doc.id || doc._id.toString() }
}

async function findProfileByOwner(ownerKey) {
  const col = getDb().collection('profiles')
  let doc = await col.findOne({ ownerId: ownerKey })
  if (!doc && ObjectId.isValid(ownerKey)) {
    doc = await col.findOne({ ownerId: new ObjectId(ownerKey) })
  }
  return doc
}

/** Keep `users` registration fields aligned with editable profile fields (Compass / admin often inspect `users`). */
async function syncUserDocFromProfilePatch(ownerKey, payload) {
  if (!ObjectId.isValid(ownerKey) || !payload || typeof payload !== 'object') return
  const userPatch = {}
  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    userPatch.pharmacyName = payload.name
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'address')) {
    userPatch.addressLine1 = payload.address
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'hours')) {
    const raw = String(payload.hours).trim()
    const m = raw.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/)
    if (m) {
      userPatch.openingTime = m[1]
      userPatch.closingTime = m[2]
    } else {
      const parts = raw.split(/\s*-\s*/)
      if (parts.length >= 2) {
        userPatch.openingTime = parts[0].trim()
        userPatch.closingTime = parts[parts.length - 1].trim()
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'deliveryCharge')) {
    const n = Number(payload.deliveryCharge)
    if (!Number.isNaN(n)) userPatch.deliveryCharge = n
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'deliveryRadius')) {
    const n = Number(payload.deliveryRadius)
    if (!Number.isNaN(n)) userPatch.serviceRadiusKm = n
  }
  if (Object.keys(userPatch).length === 0) return
  userPatch.updatedAt = new Date()
  await getDb().collection('users').updateOne(
    { _id: new ObjectId(ownerKey) },
    { $set: userPatch }
  )
}

export async function listCollection(collectionName, ownerId, sort = { createdAt: -1 }) {
  const docs = await getDb().collection(collectionName).find({ ownerId }).sort(sort).toArray()
  return docs.map(mapDoc)
}

export async function createCollectionItem(collectionName, ownerId, payload) {
  const now = new Date()
  const doc = { ...payload, ownerId, createdAt: now, updatedAt: now }
  const result = await getDb().collection(collectionName).insertOne(doc)
  return mapDoc({ ...doc, _id: result.insertedId })
}

const ORDER_TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Packed', 'Cancelled'],
  Packed: ['Dispatched', 'Cancelled'],
  Dispatched: ['Delivered'],
  Delivered: [],
  Cancelled: []
}

function marketplaceOrderStatus(fulfillments) {
  const statuses = fulfillments.map((item) => item.status)
  if (!statuses.length) return 'Processing'
  if (statuses.every((status) => status === 'Cancelled')) return 'Cancelled'
  if (statuses.every((status) => status === 'Delivered')) return 'Delivered'
  if (statuses.every((status) => status === 'Delivered' || status === 'Cancelled')) return 'Partially Delivered'
  if (statuses.some((status) => status === 'Dispatched' || status === 'Delivered')) return 'Dispatched'
  if (statuses.some((status) => status === 'Packed')) return 'Packed'
  if (statuses.every((status) => status === 'Confirmed')) return 'Confirmed'
  return 'Processing'
}

async function updateOrderStatus(ownerId, id, nextStatus) {
  const pharmacyDb = getDb()
  const orders = pharmacyDb.collection('orders')
  const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id), ownerId } : { id, ownerId }
  const session = client.startSession()
  let mappedOrder = null

  try {
    await session.withTransaction(async () => {
      const order = await orders.findOne(filter, { session })
      if (!order) throw new Error('Order not found')
      if (order.status === nextStatus) {
        mappedOrder = mapDoc(order)
        return
      }
      const allowed = ORDER_TRANSITIONS[order.status] || []
      if (!allowed.includes(nextStatus)) {
        throw new Error(`Order cannot move from ${order.status} to ${nextStatus}`)
      }

      const now = new Date()
      const update = { status: nextStatus, updatedAt: now }
      if (nextStatus === 'Cancelled' && order.inventoryReserved && !order.inventoryRestocked) {
        for (const item of order.items || []) {
          if (!ObjectId.isValid(item.productId)) continue
          await pharmacyDb.collection('products').updateOne(
            { _id: new ObjectId(item.productId), ownerId },
            { $inc: { stock: Number(item.qty ?? item.quantity ?? 0) }, $set: { updatedAt: now } },
            { session }
          )
        }
        update.inventoryRestocked = true
        update.inventoryRestockedAt = now
      }

      await orders.updateOne(filter, { $set: update }, { session })
      const updatedOrder = await orders.findOne(filter, { session })
      mappedOrder = mapDoc(updatedOrder)

      if (order.source === 'marketplace' && ObjectId.isValid(order.marketplaceOrderId)) {
        const marketplaceOrders = client.db(MARKETPLACE_DB_NAME).collection('orders')
        const marketplaceId = new ObjectId(order.marketplaceOrderId)
        await marketplaceOrders.updateOne(
          { _id: marketplaceId },
          {
            $set: {
              'fulfillments.$[fulfillment].status': nextStatus,
              'fulfillments.$[fulfillment].updatedAt': now,
              updatedAt: now
            }
          },
          { arrayFilters: [{ 'fulfillment.pharmacyOrderId': order.id }], session }
        )
        const marketplaceOrder = await marketplaceOrders.findOne({ _id: marketplaceId }, { session })
        if (marketplaceOrder) {
          await marketplaceOrders.updateOne(
            { _id: marketplaceId },
            { $set: { status: marketplaceOrderStatus(marketplaceOrder.fulfillments || []), updatedAt: now } },
            { session }
          )
        }
      }
    })
  } finally {
    await session.endSession()
  }
  return mappedOrder
}

export async function updateCollectionItem(collectionName, ownerId, id, updates) {
  if (collectionName === 'orders' && Object.prototype.hasOwnProperty.call(updates, 'status')) {
    return updateOrderStatus(ownerId, id, updates.status)
  }
  const collection = getDb().collection(collectionName)
  const byObjectId = ObjectId.isValid(id) ? { _id: new ObjectId(id), ownerId } : null
  const byIdField = { id, ownerId }
  await collection.updateOne(byObjectId || byIdField, { $set: { ...updates, updatedAt: new Date() } })
  const doc = await collection.findOne(byObjectId || byIdField)
  return doc ? mapDoc(doc) : null
}

export async function removeCollectionItem(collectionName, ownerId, id) {
  const collection = getDb().collection(collectionName)
  const byObjectId = ObjectId.isValid(id) ? { _id: new ObjectId(id), ownerId } : null
  const byIdField = { id, ownerId }
  await collection.deleteOne(byObjectId || byIdField)
  return { success: true }
}

export async function getProfile(ownerId) {
  const ownerKey = String(ownerId)
  let doc = await findProfileByOwner(ownerKey)
  let userApprovalStatus = 'unapproved'
  let accountState = { accountStatus: '', rejectionReason: '', suspensionReason: '' }
  if (ObjectId.isValid(ownerKey)) {
    const user = await getDb().collection('users').findOne(
      { _id: new ObjectId(ownerKey) },
      { projection: { status: 1, approvalStatus: 1, rejectionReason: 1, suspensionReason: 1 } }
    )
    userApprovalStatus = String(user?.approvalStatus || user?.status || 'unapproved').toLowerCase()
    accountState = {
      accountStatus: String(user?.status || '').toLowerCase(),
      rejectionReason: user?.rejectionReason || '',
      suspensionReason: user?.suspensionReason || ''
    }
  }
  if (!doc) {
    const now = new Date()
    doc = {
      ownerId: ownerKey,
      name: 'My Pharmacy',
      address: '',
      phone: '',
      email: '',
      license: '',
      hours: '8:00 AM - 10:00 PM',
      deliveryCharge: 50,
      deliveryRadius: 10,
      status: 'Open',
      approvalStatus: userApprovalStatus,
      logo: '💊',
      taxRate: 5,
      bankName: '',
      accountNo: '',
      createdAt: now,
      updatedAt: now
    }
    await getDb().collection('profiles').insertOne(doc)
  } else {
    const current = String(doc.approvalStatus || '').toLowerCase()
    if (current !== userApprovalStatus) {
      await getDb().collection('profiles').updateOne(
        { _id: doc._id },
        { $set: { approvalStatus: userApprovalStatus, updatedAt: new Date(), ownerId: ownerKey } }
      )
      doc = { ...doc, approvalStatus: userApprovalStatus, ownerId: ownerKey }
    } else {
      doc = { ...doc, approvalStatus: userApprovalStatus }
    }
  }
  // Account state is read-only context from the users record; it is not persisted on the profile.
  return { ...mapDoc(doc), ...accountState }
}

export async function upsertProfile(ownerId, updates) {
  const ownerKey = String(ownerId)
  const profiles = getDb().collection('profiles')
  let existing = await findProfileByOwner(ownerKey)
  if (!existing) {
    await getProfile(ownerKey)
    existing = await findProfileByOwner(ownerKey)
  }
  if (!existing) {
    throw new Error('Profile not found')
  }
  const now = new Date()

  let userApprovalStatus = 'unapproved'
  let accountState = { accountStatus: '', rejectionReason: '', suspensionReason: '' }
  if (ObjectId.isValid(ownerKey)) {
    const user = await getDb().collection('users').findOne(
      { _id: new ObjectId(ownerKey) },
      { projection: { status: 1, approvalStatus: 1, rejectionReason: 1, suspensionReason: 1 } }
    )
    userApprovalStatus = String(user?.approvalStatus || user?.status || 'unapproved').toLowerCase()
    accountState = {
      accountStatus: String(user?.status || '').toLowerCase(),
      rejectionReason: user?.rejectionReason || '',
      suspensionReason: user?.suspensionReason || ''
    }
  }

  const allowed = [
    'name',
    'address',
    'hours',
    'status',
    'logo',
    'deliveryCharge',
    'deliveryRadius',
    'deliveryType',
    'taxRate',
    'bankName',
    'accountNo'
  ]
  const src = updates && typeof updates === 'object' ? updates : {}
  const payload = {}
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(src, key)) continue
    let v = src[key]
    if (key === 'deliveryCharge' || key === 'deliveryRadius' || key === 'taxRate') {
      const n = Number(v)
      if (Number.isNaN(n)) continue
      v = n
    } else if (typeof v === 'string') {
      if (key === 'name' || key === 'address' || key === 'hours' || key === 'logo') v = v.trim()
      else v = v.trimEnd()
    }
    payload[key] = v
  }

  const patch = {
    ...payload,
    ownerId: ownerKey,
    approvalStatus: userApprovalStatus,
    updatedAt: now,
    phone: existing.phone,
    email: existing.email,
    license: existing.license
  }

  await profiles.updateOne({ _id: existing._id }, { $set: patch })
  await syncUserDocFromProfilePatch(ownerKey, payload)
  return getProfile(ownerKey)
}

export async function syncChatThreadsFromOrders(ownerId) {
  const orders = await getDb().collection('orders').find({ ownerId }).toArray()
  const threads = getDb().collection('chat_threads')
  const now = new Date()
  for (const order of orders) {
    const customerName = order.customer || 'Customer'
    const customerPhone = order.phone || ''
    const existing = await threads.findOne({ ownerId, customerName, customerPhone })
    if (!existing) {
      await threads.insertOne({
        ownerId,
        customerName,
        customerPhone,
        status: 'open',
        unread: 0,
        lastMessage: `Order ${order.id || ''} support thread`,
        orderId: order.id || '',
        createdAt: now,
        updatedAt: now
      })
    }
  }
  const docs = await threads.find({ ownerId }).sort({ updatedAt: -1 }).toArray()
  return docs.map(mapDoc)
}

export async function listChatMessages(ownerId, threadId) {
  const docs = await getDb().collection('chat_messages').find({ ownerId, threadId }).sort({ createdAt: 1 }).toArray()
  return docs.map(mapDoc)
}

export async function createChatMessage(ownerId, threadId, message) {
  const now = new Date()
  const payload = { ...message, ownerId, threadId, createdAt: now, updatedAt: now }
  const result = await getDb().collection('chat_messages').insertOne(payload)
  const threadFilter = ObjectId.isValid(threadId)
    ? { ownerId, _id: new ObjectId(threadId) }
    : { ownerId, id: threadId }
  await getDb().collection('chat_threads').updateOne(
    threadFilter,
    {
      $set: {
        lastMessage: message.text || (message.attachments?.length ? 'Attachment sent' : 'New message'),
        updatedAt: now
      }
    }
  )
  return mapDoc({ ...payload, _id: result.insertedId })
}

export async function logChatAi(ownerId, payload) {
  const now = new Date()
  const doc = { ownerId, ...payload, createdAt: now, updatedAt: now }
  const result = await getDb().collection('chat_ai_logs').insertOne(doc)
  return mapDoc({ ...doc, _id: result.insertedId })
}

export async function listChatAiLogs(ownerId, limit = 30) {
  const docs = await getDb().collection('chat_ai_logs').find({ ownerId }).sort({ createdAt: -1 }).limit(limit).toArray()
  return docs.map(mapDoc)
}

export async function requestPasswordReset(email) {
  const users = getDb().collection('users')
  const normalizedEmail = email.toLowerCase()
  const user = await users.findOne({ email: normalizedEmail })

  if (!user) {
    return { ok: true }
  }

  const otpCode = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await users.updateOne(
    { email: normalizedEmail },
    {
      $set: {
        resetOtpCode: otpCode,
        resetOtpExpiresAt: expiresAt,
        resetOtpAttempts: 0,
        resetOtpCreatedAt: new Date(),
        updatedAt: new Date()
      }
    }
  )

  if (!mailTransporter) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.')
  }

  await mailTransporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: normalizedEmail,
    subject: 'DawaConnect password reset OTP',
    text: `Your DawaConnect OTP is ${otpCode}. It will expire in 10 minutes.`,
    html: `<p>Your DawaConnect OTP is <b>${otpCode}</b>.</p><p>It will expire in 10 minutes.</p>`
  })

  return { ok: true }
}

export async function resetPasswordWithOtp({ email, otp, newPassword }) {
  const users = getDb().collection('users')
  const normalizedEmail = email.toLowerCase()
  const user = await users.findOne({ email: normalizedEmail })
  if (!user?.resetOtpCode || !user?.resetOtpExpiresAt) {
    throw new Error('OTP not requested or expired')
  }
  if (new Date(user.resetOtpExpiresAt) < new Date()) {
    throw new Error('OTP has expired')
  }
  if (Number(user.resetOtpAttempts || 0) >= 5) {
    throw new Error('Too many attempts. Request a new OTP.')
  }
  if (user.resetOtpCode !== otp) {
    await users.updateOne(
      { email: normalizedEmail },
      { $inc: { resetOtpAttempts: 1 }, $set: { updatedAt: new Date() } }
    )
    throw new Error('Invalid OTP code')
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await users.updateOne(
    { email: normalizedEmail },
    {
      $set: { passwordHash, updatedAt: new Date() },
      $unset: {
        resetOtpCode: '',
        resetOtpExpiresAt: '',
        resetOtpAttempts: '',
        resetOtpCreatedAt: ''
      }
    }
  )
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/* Complaints (shared MarketPlace.complaints collection)               */
/* Inbox  = customers complaining about this pharmacy (we handle them) */
/* Outbox = complaints this pharmacy files with DawaConnect admins     */
/* ------------------------------------------------------------------ */

const COMPLAINT_CATEGORIES = ['order', 'delivery', 'product', 'payment', 'service', 'platform', 'account', 'other']
const COMPLAINT_CLOSED = ['resolved', 'dismissed']

function complaintsCollection() {
  if (!client) throw new Error('Database not initialized. Set MONGODB_URI and restart the app.')
  return client.db(MARKETPLACE_DB_NAME).collection('complaints')
}

function generateComplaintId() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6)
  const random = Math.random().toString(36).toUpperCase().slice(2, 5)
  return `CMP-${stamp}${random}`
}

async function pharmacyParty(ownerId) {
  const ownerKey = String(ownerId)
  const user = ObjectId.isValid(ownerKey)
    ? await getDb().collection('users').findOne({ _id: new ObjectId(ownerKey) }, { projection: { pharmacyName: 1, email: 1, ownerName: 1 } })
    : null
  return { id: ownerKey, name: user?.pharmacyName || 'Pharmacy', email: user?.email || '', role: 'pharmacy' }
}

async function findParticipantComplaint(ownerId, id) {
  const ownerKey = String(ownerId)
  const idFilter = ObjectId.isValid(String(id)) ? { $or: [{ _id: new ObjectId(String(id)) }, { complaintId: String(id) }] } : { complaintId: String(id) }
  const doc = await complaintsCollection().findOne({
    ...idFilter,
    $or: [{ target: 'pharmacy', pharmacyId: ownerKey }, { source: 'pharmacy', 'reporter.id': ownerKey }]
  })
  if (!doc) throw new Error('Complaint not found')
  return doc
}

export async function listComplaints(ownerId) {
  const ownerKey = String(ownerId)
  const col = complaintsCollection()
  const [inbox, outbox] = await Promise.all([
    col.find({ target: 'pharmacy', pharmacyId: ownerKey }).sort({ lastActivityAt: -1 }).limit(300).toArray(),
    col.find({ source: 'pharmacy', 'reporter.id': ownerKey }).sort({ lastActivityAt: -1 }).limit(300).toArray()
  ])
  return { inbox: inbox.map(mapDoc), outbox: outbox.map(mapDoc) }
}

// Pharmacy → DawaConnect admins.
export async function createComplaint(ownerId, payload = {}) {
  const subject = String(payload.subject || '').trim().slice(0, 120)
  const description = String(payload.description || '').trim().slice(0, 2000)
  const orderId = String(payload.orderId || '').trim().slice(0, 60)
  const category = COMPLAINT_CATEGORIES.includes(payload.category) ? payload.category : 'other'
  const priority = ['low', 'medium', 'high'].includes(payload.priority) ? payload.priority : 'medium'
  if (subject.length < 5) throw new Error('Give your complaint a short subject (at least 5 characters).')
  if (description.length < 20) throw new Error('Describe the problem in at least 20 characters.')

  const reporter = await pharmacyParty(ownerId)
  const now = new Date()
  const doc = {
    complaintId: generateComplaintId(), source: 'pharmacy', target: 'admin', reporter,
    pharmacyId: reporter.id, pharmacyName: reporter.name, orderId, category, subject, description,
    priority, status: 'open', messages: [], resolution: null, lastActivityAt: now, createdAt: now, updatedAt: now
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await complaintsCollection().insertOne(doc)
      return mapDoc({ ...doc, _id: result.insertedId })
    } catch (error) {
      if (error?.code !== 11000) throw error
      doc.complaintId = generateComplaintId()
    }
  }
  throw new Error('Could not submit the complaint. Please try again.')
}

export async function replyComplaint(ownerId, id, text) {
  const message = String(text || '').trim().slice(0, 2000)
  if (!message) throw new Error('Write a message first.')
  const complaint = await findParticipantComplaint(ownerId, id)
  const party = await pharmacyParty(ownerId)
  const now = new Date()
  const handlesIt = complaint.target === 'pharmacy'
  const update = { $push: { messages: { by: party, text: message, at: now } }, $set: { lastActivityAt: now, updatedAt: now } }
  if (handlesIt && complaint.status === 'open') update.$set.status = 'in_review'
  if (!handlesIt && COMPLAINT_CLOSED.includes(complaint.status)) { update.$set.status = 'open'; update.$set.resolution = null }
  await complaintsCollection().updateOne({ _id: complaint._id }, update)
  return mapDoc(await complaintsCollection().findOne({ _id: complaint._id }))
}

// Only complaints addressed to this pharmacy can be moved by it.
export async function updateComplaintStatus(ownerId, id, status, note = '') {
  if (!['open', 'in_review', 'resolved', 'dismissed'].includes(status)) throw new Error('Invalid status')
  const complaint = await findParticipantComplaint(ownerId, id)
  if (complaint.target !== 'pharmacy') throw new Error('Only DawaConnect can change the status of complaints you filed.')
  const party = await pharmacyParty(ownerId)
  const now = new Date()
  const cleanNote = String(note || '').trim().slice(0, 1000)
  const set = { status, lastActivityAt: now, updatedAt: now }
  const update = { $set: set }
  if (COMPLAINT_CLOSED.includes(status)) {
    if (cleanNote.length < 5) throw new Error('Add a short note explaining the outcome for the customer.')
    set.resolution = { note: cleanNote, by: party, at: now }
    update.$push = { messages: { by: party, text: `${status === 'resolved' ? 'Resolved' : 'Closed'}: ${cleanNote}`, at: now } }
  } else {
    set.resolution = null
  }
  await complaintsCollection().updateOne({ _id: complaint._id }, update)
  return mapDoc(await complaintsCollection().findOne({ _id: complaint._id }))
}
