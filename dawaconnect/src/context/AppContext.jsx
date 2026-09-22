import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'

const AppContext = createContext()
export const useApp = () => useContext(AppContext)

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const mapDoc = (doc) => ({ ...doc, id: doc.id || doc._id })
const formatRelativeTime = (value) => {
  if (!value) return 'Just now'
  const time = new Date(value).getTime()
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000))
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`
  return `${Math.floor(seconds / 86400)} day ago`
}

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('sessionUser')
    return raw ? JSON.parse(raw) : null
  })
  const [inventory, setInventory] = useState([])
  const [orders, setOrders] = useState([])
  const [staff, setStaff] = useState([])
  const [reviews, setReviews] = useState([])
  const [returns, setReturns] = useState([])
  const [notifications, setNotifications] = useState([])
  const [complaints, setComplaints] = useState({ inbox: [], outbox: [] })
  const [toasts, setToasts] = useState([])
  const [authLoading, setAuthLoading] = useState(false)
  const [pharmacyProfile, setPharmacyProfileState] = useState({
    name: 'My Pharmacy',
    address: '',
    phone: '',
    email: '',
    license: '',
    hours: '8:00 AM - 10:00 PM',
    deliveryCharge: 50,
    deliveryRadius: 10,
    status: 'Open',
    approvalStatus: 'unapproved',
    logo: '💊',
    taxRate: 5,
    bankName: '',
    accountNo: '',
    deliveryType: 'Self Delivery'
  })

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts((p) => [...p, { id, message, type }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500)
  }, [])

  const fetchEntity = async (entity, ownerId, setter) => {
    const result = await window.electronAPI.entity.list({ entity, ownerId, sort: { createdAt: -1 } })
    if (result.ok) {
      const rows = result.data.map(mapDoc)
      if (entity === 'notifications') {
        setter(rows.map((n) => ({ ...n, time: formatRelativeTime(n.createdAt) })))
      } else {
        setter(rows)
      }
    }
  }

  const loadAllData = useCallback(async (ownerId) => {
    if (!ownerId || !window.electronAPI) return
    const ownerKey = String(ownerId)

    const inventoryResult = await window.electronAPI.products.list({ ownerId: ownerKey })
    if (inventoryResult.ok) setInventory(inventoryResult.data.map((p) => ({ ...p, id: p._id })))

    await Promise.all([
      fetchEntity('orders', ownerKey, setOrders),
      fetchEntity('staff', ownerKey, setStaff),
      fetchEntity('reviews', ownerKey, setReviews),
      fetchEntity('returns', ownerKey, setReturns),
      fetchEntity('notifications', ownerKey, setNotifications)
    ])

    if (window.electronAPI.complaints) {
      const complaintsResult = await window.electronAPI.complaints.list({ ownerId: ownerKey })
      if (complaintsResult.ok) setComplaints(complaintsResult.data)
    }

    const profileResult = await window.electronAPI.profile.get({ ownerId: ownerKey })
    if (profileResult.ok) {
      const p = mapDoc(profileResult.data)
      setPharmacyProfileState(p)
      setUser((u) => {
        if (!u || String(u.id) !== ownerKey) return u
        let changed = false
        const next = { ...u }
        const apNext = String(p.approvalStatus || 'unapproved').toLowerCase()
        const apPrev = String(u.approvalStatus || '').toLowerCase()
        if (apNext !== apPrev) {
          next.approvalStatus = p.approvalStatus
          changed = true
        }
        // Admin decisions (rejection / suspension) travel with the users record.
        for (const key of ['accountStatus', 'rejectionReason', 'suspensionReason']) {
          if (p[key] !== undefined && String(p[key] ?? '') !== String(u[key] ?? '')) {
            next[key] = p[key]
            changed = true
          }
        }
        if (p.name != null && String(p.name) !== String(u.pharmacyName ?? '')) {
          next.pharmacyName = p.name
          changed = true
        }
        return changed ? next : u
      })
    }
  }, [])

  useEffect(() => {
    let active = true
    const restoreSession = async () => {
      const raw = localStorage.getItem('sessionUser')
      if (!raw || !window.electronAPI?.auth?.restore) return
      try {
        const cached = JSON.parse(raw)
        if (!cached?.sessionToken) return
        setAuthLoading(true)
        const result = await window.electronAPI.auth.restore({ sessionToken: cached.sessionToken })
        if (!active) return
        if (result.ok) {
          setUser(result.data)
        } else {
          setUser(null)
          localStorage.removeItem('sessionUser')
        }
      } catch {
        if (active) {
          setUser(null)
          localStorage.removeItem('sessionUser')
        }
      } finally {
        if (active) setAuthLoading(false)
      }
    }
    restoreSession()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem('sessionUser', JSON.stringify(user))
      loadAllData(user.id)
    } else {
      localStorage.removeItem('sessionUser')
    }
  }, [user, loadAllData])

  useEffect(() => {
    if (!user?.id || !window.electronAPI) return undefined
    const ownerKey = String(user.id)
    const refreshCommerceData = async () => {
      const inventoryResult = await window.electronAPI.products.list({ ownerId: ownerKey })
      if (inventoryResult.ok) setInventory(inventoryResult.data.map((product) => ({ ...product, id: product._id })))
      await Promise.all([
        fetchEntity('orders', ownerKey, setOrders),
        fetchEntity('notifications', ownerKey, setNotifications)
      ])
      if (window.electronAPI.complaints) {
        const complaintsResult = await window.electronAPI.complaints.list({ ownerId: ownerKey })
        if (complaintsResult.ok) setComplaints(complaintsResult.data)
      }
      const profileResult = await window.electronAPI.profile.get({ ownerId: ownerKey })
      if (profileResult.ok) {
        const p = mapDoc(profileResult.data)
        setUser((u) => {
          if (!u || String(u.id) !== ownerKey) return u
          const next = { ...u }
          let changed = false
          for (const key of ['approvalStatus', 'accountStatus', 'rejectionReason', 'suspensionReason']) {
            if (p[key] !== undefined && String(p[key] ?? '') !== String(u[key] ?? '')) { next[key] = p[key]; changed = true }
          }
          return changed ? next : u
        })
      }
    }
    const interval = setInterval(refreshCommerceData, 10000)
    return () => clearInterval(interval)
  }, [user?.id])

  const login = async (email, password) => {
    setAuthLoading(true)
    try {
      const result = await window.electronAPI.auth.login({ email, password })
      if (!result.ok) return { ok: false, error: result.error || 'Login failed' }
      setUser(result.data)
      return { ok: true }
    } finally {
      setAuthLoading(false)
    }
  }

  const register = async (payload) => {
    setAuthLoading(true)
    try {
      const result = await window.electronAPI.auth.register(payload)
      if (!result.ok) return { ok: false, error: result.error || 'Registration failed' }
      return { ok: true }
    } finally {
      setAuthLoading(false)
    }
  }

  const checkRegistrationAvailability = async ({ email, phone }) => {
    try {
      const result = await window.electronAPI.auth.registrationAvailability({ email, phone })
      if (!result.ok) {
        return { ok: false, error: result.error || 'Could not verify email or phone', emailTaken: false, phoneTaken: false }
      }
      return { ok: true, emailTaken: !!result.data?.emailTaken, phoneTaken: !!result.data?.phoneTaken }
    } catch (e) {
      return { ok: false, error: e?.message || 'Could not verify email or phone', emailTaken: false, phoneTaken: false }
    }
  }

  const logout = () => {
    const currentUser = user
    if (currentUser?.sessionToken || currentUser?.id) {
      window.electronAPI.auth.logout({
        sessionToken: currentUser.sessionToken,
        userId: currentUser.id
      }).catch(() => {})
    }
    setUser(null)
    setInventory([])
    setOrders([])
    setStaff([])
    setReviews([])
    setReturns([])
    setNotifications([])
    localStorage.removeItem('sessionUser')
  }

  const requestPasswordReset = async (email) => window.electronAPI.auth.forgotRequest({ email })
  const resetPasswordWithOtp = async (payload) => window.electronAPI.auth.forgotReset(payload)

  const addInventoryItem = async (item) => {
    if (!user?.id) {
      showToast('You must be signed in to add items.', 'error')
      return { ok: false }
    }
    const result = await window.electronAPI.products.create({ ownerId: user.id, product: item })
    if (result.ok && result.data) {
      setInventory((p) => [{ ...result.data, id: result.data._id }, ...p])
      showToast('Medicine added to inventory')
      return { ok: true }
    }
    showToast(result.error || 'Could not add medicine', 'error')
    return { ok: false }
  }

  const updateInventoryItem = async (id, updates) => {
    if (!user?.id) {
      showToast('You must be signed in to update items.', 'error')
      return { ok: false }
    }
    const result = await window.electronAPI.products.update({ ownerId: user.id, product: { id, ...updates } })
    if (result.ok && result.data) {
      setInventory((p) => p.map((i) => (i.id === id ? { ...result.data, id: result.data._id } : i)))
      showToast('Inventory updated')
      return { ok: true }
    }
    showToast(result.error || 'Could not update medicine', 'error')
    return { ok: false }
  }

  const deleteInventoryItem = async (id) => {
    if (!user?.id) return
    await window.electronAPI.products.remove({ ownerId: user.id, id })
    setInventory((p) => p.filter((i) => i.id !== id))
    showToast('Item removed')
  }

  const addNotification = async (notif) => {
    if (!user?.id) return
    const result = await window.electronAPI.entity.create({
      entity: 'notifications',
      ownerId: user.id,
      item: { ...notif, read: false }
    })
    if (result.ok) setNotifications((p) => [{ ...mapDoc(result.data), time: 'Just now' }, ...p])
  }

  const markAllNotificationsRead = async () => {
    if (!user?.id) return
    const unread = notifications.filter((n) => !n.read)
    await Promise.all(
      unread.map((n) => window.electronAPI.entity.update({
        entity: 'notifications',
        ownerId: user.id,
        id: n.id,
        updates: { read: true }
      }))
    )
    setNotifications((p) => p.map((n) => ({ ...n, read: true })))
  }

  const updateOrderStatus = async (id, status) => {
    if (!user?.id) return
    const result = await window.electronAPI.entity.update({ entity: 'orders', ownerId: user.id, id, updates: { status } })
    if (!result.ok) {
      showToast(result.error || 'Order status could not be updated', 'error')
      return
    }
    if (result.data) setOrders((p) => p.map((o) => (o.id === id ? mapDoc(result.data) : o)))
    showToast(`Order ${id} updated to ${status}`)
    if (status === 'Confirmed') await addNotification({ type: 'order', message: `Order ${id} confirmed`, color: '#14b8a6' })
  }

  const addStaff = async (member) => {
    if (!user?.id) return
    const result = await window.electronAPI.entity.create({ entity: 'staff', ownerId: user.id, item: member })
    if (result.ok) setStaff((p) => [mapDoc(result.data), ...p])
    showToast('Staff member added')
  }

  const removeStaff = async (id) => {
    if (!user?.id) return
    await window.electronAPI.entity.remove({ entity: 'staff', ownerId: user.id, id })
    setStaff((p) => p.filter((member) => member.id !== id))
    showToast('Staff removed')
  }

  const updateReturn = async (id, status) => {
    if (!user?.id) return
    const result = await window.electronAPI.entity.update({ entity: 'returns', ownerId: user.id, id, updates: { status } })
    if (result.ok && result.data) setReturns((p) => p.map((ret) => (ret.id === id ? mapDoc(result.data) : ret)))
    showToast(`Return ${id} ${status}`)
  }

  const setPharmacyProfile = async (profile) => {
    if (!user?.id) {
      showToast('You must be signed in to save your profile.', 'error')
      return { ok: false, error: 'Not signed in' }
    }
    const ownerKey = String(user.id)
    const result = await window.electronAPI.profile.save({ ownerId: ownerKey, profile })
    if (result.ok && result.data) {
      const data = mapDoc(result.data)
      setPharmacyProfileState(data)
      setUser((u) => {
        if (!u) return u
        let changed = false
        const next = { ...u }
        const apNext = String(data.approvalStatus || 'unapproved').toLowerCase()
        const apPrev = String(u.approvalStatus || '').toLowerCase()
        if (apNext !== apPrev) {
          next.approvalStatus = data.approvalStatus
          changed = true
        }
        if (data.name != null && String(data.name) !== String(u.pharmacyName ?? '')) {
          next.pharmacyName = data.name
          changed = true
        }
        return changed ? next : u
      })
      showToast('Profile updated successfully')
      return { ok: true, data }
    }
    const err = result.error || 'Could not save profile'
    showToast(err, 'error')
    return { ok: false, error: err }
  }

  const applyComplaint = (updated) => {
    setComplaints((current) => {
      const replace = (list) => list.map((c) => (c.id === updated.id ? updated : c))
      const inInbox = current.inbox.some((c) => c.id === updated.id)
      const inOutbox = current.outbox.some((c) => c.id === updated.id)
      return {
        inbox: inInbox ? replace(current.inbox) : current.inbox,
        outbox: inOutbox ? replace(current.outbox) : updated.source === 'pharmacy' ? [updated, ...current.outbox] : current.outbox
      }
    })
  }

  const fileComplaint = async (complaint) => {
    if (!user?.id) return { ok: false, error: 'Not signed in' }
    const result = await window.electronAPI.complaints.create({ ownerId: String(user.id), complaint })
    if (result.ok) { applyComplaint(result.data); showToast(`Complaint ${result.data.complaintId} sent to DawaConnect`) } else showToast(result.error, 'error')
    return result
  }

  const replyToComplaint = async (id, text) => {
    if (!user?.id) return { ok: false, error: 'Not signed in' }
    const result = await window.electronAPI.complaints.reply({ ownerId: String(user.id), id, text })
    if (result.ok) applyComplaint(result.data); else showToast(result.error, 'error')
    return result
  }

  const setComplaintStatus = async (id, status, note) => {
    if (!user?.id) return { ok: false, error: 'Not signed in' }
    const result = await window.electronAPI.complaints.updateStatus({ ownerId: String(user.id), id, status, note })
    if (result.ok) { applyComplaint(result.data); showToast(`Complaint marked ${status.replace('_', ' ')}`) } else showToast(result.error, 'error')
    return result
  }

  const openComplaintCount = complaints.inbox.filter((c) => ['open', 'in_review'].includes(c.status)).length

  const unreadCount = notifications.filter((n) => !n.read).length
  const lowStockItems = inventory.filter((i) => i.stock <= i.threshold)
  const expiringItems = inventory.filter((i) => {
    const days = Math.ceil((new Date(i.expiry) - new Date()) / (1000 * 60 * 60 * 24))
    return days <= 60 && days > 0
  })

  const salesData = useMemo(() => {
    const byDay = DAYS.map((day) => ({ day, revenue: 0, orders: 0 }))
    for (const order of orders) {
      const dt = order.date ? new Date(order.date) : new Date()
      const row = byDay.find((d) => d.day === DAYS[dt.getDay()])
      if (row) {
        row.orders += 1
        if (order.status === 'Delivered') row.revenue += Number(order.total || 0)
      }
    }
    return byDay
  }, [orders])

  const monthlyData = useMemo(() => {
    const year = new Date().getFullYear()
    const byMonth = MONTHS.map((month) => ({ month, revenue: 0 }))
    for (const order of orders) {
      const dt = order.date ? new Date(order.date) : null
      if (!dt || dt.getFullYear() !== year) continue
      if (order.status === 'Delivered') byMonth[dt.getMonth()].revenue += Number(order.total || 0)
    }
    const used = byMonth.filter((m) => m.revenue > 0)
    return used.length ? used.slice(-6) : byMonth.slice(-6)
  }, [orders])

  return (
    <AppContext.Provider value={{
      user, login, register, checkRegistrationAvailability, logout, authLoading, requestPasswordReset, resetPasswordWithOtp,
      inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem,
      orders, updateOrderStatus,
      staff, addStaff, removeStaff,
      reviews, returns, updateReturn,
      notifications, markAllNotificationsRead, addNotification,
      complaints, fileComplaint, replyToComplaint, setComplaintStatus, openComplaintCount,
      toasts, showToast,
      pharmacyProfile, setPharmacyProfile,
      unreadCount, lowStockItems, expiringItems,
      salesData, monthlyData
    }}>
      {children}
    </AppContext.Provider>
  )
}
