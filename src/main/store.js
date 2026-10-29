const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// 配置版本：默认形象/模型调整后置新版本号，
// 使旧的 settings.json 中已过期的字段被重新纠正，避免默认值被永久锁死
const CONFIG_VERSION = 5;

// ---- 模型资源定位 ----------------------------------------------------
// l2d-widget 内部用 fetch() 加载模型，而 file:// 页面里 fetch(file://) 会被 Chromium 拦掉，
// 所以本地模型统一走主进程注册的自定义特权协议 petres://（见 main.js registerResProtocol）。
const RES_SCHEME = 'petres';
const ASSETS_ROOT = path.join(app.getAppPath(), 'assets');
const LOCAL_MODEL_URL = `${RES_SCHEME}://models/cat-white/model.json`;
const CDN_MODEL_URL = 'https://model.hacxy.cn/cat-white/model.json';

function hasLocalModel() {
  return fs.existsSync(path.join(ASSETS_ROOT, 'models', 'cat-white', 'model.json'));
}

// 本地已内置（npm run fetch-models）时优先本地：断网/CDN 挂了也能出猫
function defaultModelPath() {
  return hasLocalModel() ? LOCAL_MODEL_URL : CDN_MODEL_URL;
}

// 供渲染进程按顺序探活兜底，去重后返回
function modelCandidates() {
  return [defaultModelPath(), LOCAL_MODEL_URL, CDN_MODEL_URL].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );
}

// 默认设置
const defaultSettings = {
  configVersion: CONFIG_VERSION,

  // 形象设置
  appearance: {
    modelPath: defaultModelPath(),
    alwaysOnTop: true,
    scale: 1.0
  },

  // 通用（开机自启等）
  general: {
    autoLaunch: true
  },
  
  // 人设
  persona: {
    preset: 'genki-girl', // genki-girl, cool-cat, gentle-butler, programmer-colleague
    name: '狸宝',
    personality: '元气活泼，喜欢撒娇，是陪在桌面身边的桌宠',
    tone: '可爱、俏皮',
    catchphrase: '喵~',
    userTitle: '主人'
  },
  
  // 提醒设置
  reminders: {
    morningWork: { enabled: true, time: '09:30', text: '新的一天开始啦，一起加油喵~' },
    lunch: { enabled: true, time: '12:00', text: '该吃午饭啦，记得好好休息哦~' },
    afternoonWork: { enabled: true, time: '13:30', text: '午休结束啦，下午也要元气满满哦~' },
    offwork: { enabled: true, time: '19:30', text: '辛苦一天啦，回家好好休息吧~' },
    standup: { enabled: true, interval: 50, text: '站起来活动一下吧，伸个懒腰~' },
    custom: []
  },
  
  // LLM 配置
  llm: {
    enabled: true,
    baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.LLM_API_KEY || '',  // 通过环境变量或设置面板配置
    model: process.env.LLM_MODEL || 'gpt-3.5-turbo'
  },
  
  // 窗口位置（自动保存）
  windowPosition: null
};

// 逐层合并，保证嵌套对象的默认字段不丢失
function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) return override;
  if (!override || !base || typeof override !== 'object' || typeof base !== 'object') {
    return override === undefined ? base : override;
  }
  const result = { ...base };
  for (const key of Object.keys(override)) {
    result[key] = deepMerge(base[key], override[key]);
  }
  return result;
}

// 读盘：容忍 BOM（PowerShell / 记事本存出的 UTF-8 带 \uFEFF，直接 JSON.parse 会报语法错）
function readSavedSettings() {
  const raw = fs.readFileSync(settingsPath, 'utf-8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

// 上一次读盘是否失败。失败时禁止写回：
// getAll() 读失败会返回默认值，若再经 setAll() 落盘，会把用户的 apiKey/提醒等配置整片冲掉（已踩过）。
let readFailed = false;

// 读取设置
function getAll() {
  let merged = { ...defaultSettings };
  try {
    if (fs.existsSync(settingsPath)) {
      const saved = readSavedSettings();
      readFailed = false;
      merged = deepMerge(defaultSettings, saved);

      // 版本落后时，只重置“由代码维护”的默认项，且按版本精准触发。
      // 绝不碰 llm.apiKey / llm.baseURL 这类用户自己配的东西。
      const from = saved.configVersion ?? 0;
      if (from < CONFIG_VERSION) {
        if (from < 5) {
          // v5: 本地内置模型优先
          merged.appearance.modelPath = defaultModelPath();
        }
        if (from < 4) {
          // v4: 提醒配置全面升级（上下班时间+亲密文案）
          // 旧版行为：同时重置 llm.model。v5 起不再覆盖用户选的模型，否则会把
          // 类似 qwen3.8-flash 这种自建网关模型改回 gpt-3.5-turbo 导致对话直接不可用。
          merged.llm.model = defaultSettings.llm.model;
          merged.reminders = defaultSettings.reminders;
        }
        // v3: 角色重定义为狸宝
        if (from < 3) {
          merged.persona = defaultSettings.persona;
        }
        merged.configVersion = CONFIG_VERSION;
        setAll(merged);
      }
    }
  } catch (err) {
    // 配置解析失败时不能静默降级：先备份原文件，并锁住后续写入，至少还能手工恢复。
    readFailed = true;
    console.error('Failed to read settings:', err);
    try {
      // 备份名用内容哈希而不是时间戳：同一份坏配置反复解析失败只留一份，不会刷屏；
      // 内容变了才会新增，仍能区分不同次损坏。
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 10);
      const bak = `${settingsPath}.bad-${hash}`;
      if (!fs.existsSync(bak)) {
        fs.copyFileSync(settingsPath, bak);
        console.error(`settings.json 解析失败，原文件已备份到 ${bak}`);
      }
    } catch (copyErr) {
      console.error('备份损坏的 settings.json 失败:', copyErr.message);
    }
  }
  // modelCandidates 是派生值，每次实时计算，不落盘、不受旧配置影响
  merged.appearance = { ...merged.appearance, modelCandidates: modelCandidates() };
  return merged;
}

// 保存设置（剔除派生字段，避免写进 settings.json 后把旧值锁死）
function setAll(settings) {
  try {
    if (readFailed && fs.existsSync(settingsPath)) {
      console.error('settings.json 当前不可解析，已跳过写入以免覆盖用户配置（请从 .bad-* 备份恢复或修好 JSON）');
      return false;
    }
    const clean = { ...settings };
    if (clean.appearance) {
      const { modelCandidates: _drop, ...rest } = clean.appearance;
      clean.appearance = rest;
    }
    fs.writeFileSync(settingsPath, JSON.stringify(clean, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save settings:', err);
    return false;
  }
}

// 获取单个设置
function get(key) {
  const settings = getAll();
  return settings[key];
}

// 设置单个值（返回是否真的落盘成功）
function set(key, value) {
  const settings = getAll();
  settings[key] = value;
  return setAll(settings);
}

module.exports = { getAll, setAll, get, set, RES_SCHEME, ASSETS_ROOT, defaultModelPath };
