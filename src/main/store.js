const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// 配置版本：默认形象/模型调整后置新版本号，
// 使旧的 settings.json 中已过期的字段被重新纠正，避免默认值被永久锁死
const CONFIG_VERSION = 4;

// 默认设置
const defaultSettings = {
  configVersion: CONFIG_VERSION,

  // 形象设置
  appearance: {
    modelPath: 'https://model.hacxy.cn/cat-white/model.json',
    alwaysOnTop: true,
    scale: 1.0
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
    baseURL: process.env.LLM_BASE_URL || 'https://ai-gateway.gzmiyuan.com/v1',
    apiKey: process.env.LLM_API_KEY || '',  // 通过环境变量或设置面板配置
    model: 'qwen3.8-flash'  // 蜜源网关支持 qwen3.8-flash
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

// 读取设置
function getAll() {
  try {
    if (fs.existsSync(settingsPath)) {
      const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      const merged = deepMerge(defaultSettings, saved);

      // 版本落后时，用当前默认值覆盖由代码维护的可选项
      if ((saved.configVersion ?? 0) < CONFIG_VERSION) {
        merged.appearance.modelPath = defaultSettings.appearance.modelPath;
        merged.llm.model = defaultSettings.llm.model;
        // v4: 提醒配置全面升级（上下班时间+亲密文案）
        merged.reminders = defaultSettings.reminders;
        // v3: 角色重定义为狸宝
        if ((saved.configVersion ?? 0) < 3) {
          merged.persona = defaultSettings.persona;
        }
        merged.configVersion = CONFIG_VERSION;
        setAll(merged);
      }
      return merged;
    }
  } catch (err) {
    console.error('Failed to read settings:', err);
  }
  return { ...defaultSettings };
}

// 保存设置
function setAll(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

// 获取单个设置
function get(key) {
  const settings = getAll();
  return settings[key];
}

// 设置单个值
function set(key, value) {
  const settings = getAll();
  settings[key] = value;
  setAll(settings);
}

module.exports = { getAll, setAll, get, set };
