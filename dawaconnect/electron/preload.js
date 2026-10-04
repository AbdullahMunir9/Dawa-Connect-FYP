import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  location: {
    available: () => ipcRenderer.invoke('location:available'),
    search: (query) => ipcRenderer.invoke('location:search', query),
    confirm: (point) => ipcRenderer.invoke('location:confirm', point)
  },
  auth: {
    register: (payload) => ipcRenderer.invoke('auth:register', payload),
    registrationAvailability: (payload) => ipcRenderer.invoke('auth:registration-availability', payload),
    login: (payload) => ipcRenderer.invoke('auth:login', payload),
    restore: (payload) => ipcRenderer.invoke('auth:restore', payload),
    logout: (payload) => ipcRenderer.invoke('auth:logout', payload),
    forgotRequest: (payload) => ipcRenderer.invoke('auth:forgot-request', payload),
    forgotReset: (payload) => ipcRenderer.invoke('auth:forgot-reset', payload)
  },
  products: {
    list: (payload) => ipcRenderer.invoke('products:list', payload),
    create: (payload) => ipcRenderer.invoke('products:create', payload),
    update: (payload) => ipcRenderer.invoke('products:update', payload),
    remove: (payload) => ipcRenderer.invoke('products:remove', payload)
  },
  entity: {
    list: (payload) => ipcRenderer.invoke('entity:list', payload),
    create: (payload) => ipcRenderer.invoke('entity:create', payload),
    update: (payload) => ipcRenderer.invoke('entity:update', payload),
    remove: (payload) => ipcRenderer.invoke('entity:remove', payload)
  },
  profile: {
    get: (payload) => ipcRenderer.invoke('profile:get', payload),
    save: (payload) => ipcRenderer.invoke('profile:save', payload)
  },
  complaints: {
    list: (payload) => ipcRenderer.invoke('complaints:list', payload),
    create: (payload) => ipcRenderer.invoke('complaints:create', payload),
    reply: (payload) => ipcRenderer.invoke('complaints:reply', payload),
    updateStatus: (payload) => ipcRenderer.invoke('complaints:update-status', payload)
  },
  chat: {
    connect: (payload) => ipcRenderer.invoke('chat:connect', payload),
    listConversations: () => ipcRenderer.invoke('chat:list-conversations'),
    join: (payload) => ipcRenderer.invoke('chat:join', payload),
    listMessages: (payload) => ipcRenderer.invoke('chat:list-messages', payload),
    sendMessage: (payload) => ipcRenderer.invoke('chat:send-message', payload),
    markRead: (payload) => ipcRenderer.invoke('chat:mark-read', payload),
    onEvent: (callback) => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('chat:event', listener)
      return () => ipcRenderer.removeListener('chat:event', listener)
    }
  }
})
