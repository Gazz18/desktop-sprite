const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('desktopPet', {
  // 设置相关
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
  
  // 通知相关
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),
  
  // 窗口控制
  showMainWindow: () => ipcRenderer.invoke('show-main-window'),
  
  // 对话相关
  chat: (message) => ipcRenderer.invoke('chat', message),
  clearChatHistory: () => ipcRenderer.invoke('clear-chat-history'),
  
  // 监听事件
  onShowBubble: (callback) => {
    ipcRenderer.on('show-bubble', (event, text, type) => callback(text, type));
  },
  onSettingsUpdated: (callback) => {
    ipcRenderer.on('settings-updated', (event, settings) => callback(settings));
  }
});
