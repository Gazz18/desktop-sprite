const { app, BrowserWindow, Tray, Menu, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const { startReminders, stopReminders } = require('./reminders');
const { chat, clearHistory } = require('./llm');

let mainWindow = null;
let settingsWindow = null;
let tray = null;

// 获取应用数据目录
function getUserDataPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

// 创建主窗口
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 460,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 把渲染进程日志转发到终端，便于排查 Live2D / 对话问题
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[renderer:${level}] ${message}`);
  });
  
  // 窗口位置持久化
  const pos = store.get('windowPosition');
  if (pos) {
    mainWindow.setPosition(pos.x, pos.y);
  } else {
    // 默认右下角
    const { screen } = require('electron');
    const display = screen.getPrimaryDisplay();
    const { width, height } = display.workAreaSize;
    mainWindow.setPosition(width - 320, height - 480);
  }

  mainWindow.on('moved', () => {
    const [x, y] = mainWindow.getPosition();
    store.set('windowPosition', { x, y });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 创建设置窗口
function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 700,
    frame: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));
  
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// 创建系统托盘
function createTray() {
  // 使用一个简单的图标（如果不存在则用默认）
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  if (fs.existsSync(iconPath)) {
    tray = new Tray(iconPath);
  } else {
    // 创建一个简单的 16x16 透明图标
    const { nativeImage } = require('electron');
    const img = nativeImage.createEmpty();
    tray = new Tray(img);
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
          }
        }
      }
    },
    {
      label: '设置',
      click: () => {
        createSettingsWindow();
      }
    },
    {
      label: '打招呼',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('show-bubble', '你好呀~有什么需要帮忙的吗？');
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('桌面精灵');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
}

// 显示系统通知
function showNotification(title, body) {
  new Notification({ title, body }).show();
}

// IPC 处理
ipcMain.handle('get-settings', () => {
  return store.getAll();
});

ipcMain.handle('set-settings', (event, settings) => {
  store.setAll(settings);
  // 通知渲染进程设置已更新
  if (mainWindow) {
    mainWindow.webContents.send('settings-updated', settings);
  }
  return true;
});

ipcMain.handle('show-notification', (event, { title, body }) => {
  showNotification(title, body);
});

ipcMain.handle('show-main-window', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.handle('chat', async (event, message) => {
  return await chat(message);
});

ipcMain.handle('clear-chat-history', () => {
  clearHistory();
  return true;
});

// 应用启动
app.whenReady().then(() => {
  createMainWindow();
  createTray();
  startReminders(mainWindow);
});

app.on('window-all-closed', () => {
  stopReminders();
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});
