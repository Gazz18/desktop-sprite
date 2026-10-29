const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, protocol, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const { startReminders, stopReminders } = require('./reminders');
const { chat, clearHistory } = require('./llm');

const { RES_SCHEME, ASSETS_ROOT } = store;

let mainWindow = null;
let settingsWindow = null;
let tray = null;

const RES_MIME = {
  '.json': 'application/json',
  '.moc': 'application/octet-stream',
  '.moc3': 'application/octet-stream',
  '.mtn': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

// registerSchemesAsPrivileged 必须在 app ready 之前调用，否则 petres:// 用不了 fetch
protocol.registerSchemesAsPrivileged([{
  scheme: RES_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
}]);

// petres://models/cat-white/model.json -> <项目>/assets/models/cat-white/model.json
function registerResProtocol() {
  protocol.handle(RES_SCHEME, (request) => {
    const url = new URL(request.url);
    // standard scheme 下 host 是路径第一段，拼回 assets 下的相对路径
    const rel = path.posix.join(url.host, decodeURIComponent(url.pathname));
    const filePath = path.resolve(ASSETS_ROOT, rel);

    if (!filePath.startsWith(ASSETS_ROOT + path.sep) || !fs.existsSync(filePath)) {
      return new Response('not found', { status: 404 });
    }
    return new Response(fs.readFileSync(filePath), {
      status: 200,
      headers: { 'Content-Type': RES_MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' }
    });
  });
}

// 开机自启：开发态指向 electron.exe + 应用目录，打包态指向 exe 自身
function applyAutoLaunch() {
  const enabled = store.getAll().general?.autoLaunch !== false;
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: app.isPackaged ? [] : [app.getAppPath()]
    });
    console.log(`[autoLaunch] 开机自启已${enabled ? '开启' : '关闭'}`);
  } catch (e) {
    console.warn('[autoLaunch] 设置失败:', e.message);
  }
}

// 窗口显隐（托盘点击/菜单共用）
function toggleMainWindow() {
  if (!mainWindow) {
    createMainWindow();
    return;
  }
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// 创建主窗口
function createMainWindow() {
  const cfg = store.getAll();

  mainWindow = new BrowserWindow({
    width: 300,
    height: 460,
    frame: false,
    transparent: true,
    alwaysOnTop: cfg.appearance?.alwaysOnTop !== false,
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

  // 窗口位置持久化（必须钳制到当前真实存在的屏幕）
  placeWindowOnScreen(mainWindow);

  mainWindow.on('moved', () => {
    const [x, y] = mainWindow.getPosition();
    store.set('windowPosition', { x, y });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 双屏/拔屏/改分辨率后，保存的坐标可能落在已不存在的屏幕上，
// 表现为“进程活着、猫在屏幕外画”，用户看到的却是“没加载”。
function placeWindowOnScreen(win, useSaved = true) {
  const [w, h] = win.getSize();
  const saved = useSaved ? store.get('windowPosition') : null;

  const onScreen = !!saved && screen.getAllDisplays().some((d) => {
    const cx = saved.x + w / 2;
    const cy = saved.y + h / 2;
    return cx >= d.bounds.x && cx < d.bounds.x + d.bounds.width &&
           cy >= d.bounds.y && cy < d.bounds.y + d.bounds.height;
  });

  if (onScreen) {
    win.setPosition(saved.x, saved.y);
    return;
  }

  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + workArea.width - w - 20;
  const y = workArea.y + workArea.height - h - 20;
  win.setPosition(x, y);
  if (saved) {
    console.log(`[window] 保存的位置 (${saved.x},${saved.y}) 已不在任何屏幕内，回到主屏右下角`);
  }
  store.set('windowPosition', { x, y });
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
  const iconPath = path.join(ASSETS_ROOT, 'icon.png');
  let image = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : null;

  if (!image || image.isEmpty()) {
    // 空图标在通知区域是“看不见的托盘”：一旦窗口被 hide，用户就没有恢复入口，
    // 看上去和“应用根本没启动”完全一样。必须给足提示。
    console.warn(`[tray] 图标缺失或为空: ${iconPath}，请运行 npm run make-icon 生成`);
    image = nativeImage.createEmpty();
  }

  tray = new Tray(image);
  tray.setToolTip('狸宝桌宠');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', toggleMainWindow);
}

function buildTrayMenu() {
  const autoLaunch = store.getAll().general?.autoLaunch !== false;

  return Menu.buildFromTemplate([
    { label: '显示/隐藏', click: toggleMainWindow },
    { label: '设置', click: createSettingsWindow },
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
      label: '开机自启',
      type: 'checkbox',
      checked: autoLaunch,
      click: (item) => {
        const general = { ...store.getAll().general, autoLaunch: item.checked };
        store.set('general', general);
        applyAutoLaunch();
        rebuildTrayMenu();
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);
}

function rebuildTrayMenu() {
  if (tray) tray.setContextMenu(buildTrayMenu());
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
  // 把真实写入结果回传给设置面板：写被拒时（配置文件不可解析）不能骗用户“已保存”
  const saved = store.setAll(settings);
  // 置顶开关以前只存盘不生效，这里同步到已存在的窗口
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(settings?.appearance?.alwaysOnTop !== false);
    // 通知渲染进程设置已更新
    mainWindow.webContents.send('settings-updated', settings);
  }
  applyAutoLaunch();
  rebuildTrayMenu();
  return saved;
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

// 单实例锁：没有它时重复启动会出两只猫 + 两个托盘，看起来像“卡住/没加载”
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  // 应用启动
  app.whenReady().then(() => {
    registerResProtocol();
    createMainWindow();
    createTray();
    // 传 getter 而不是窗口本体，否则窗口重建后定时器会打到已销毁的 webContents
    startReminders(() => mainWindow);
    applyAutoLaunch();

    // 插拨显示器/改分辨率时，把可能跑到屏幕外的窗口拉回来
    screen.on('display-metrics-changed', () => {
      if (mainWindow) placeWindowOnScreen(mainWindow);
    });
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
}
