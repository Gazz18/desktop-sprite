// 设置面板逻辑
let currentSettings = null;

// 初始化
async function init() {
  // 加载设置
  currentSettings = await window.desktopPet.getSettings();
  
  // 填充表单
  loadSettingsToForm();
  
  // 绑定事件
  bindEvents();
}

// 加载设置到表单
function loadSettingsToForm() {
  // 形象
  document.getElementById('model-path').value = currentSettings.appearance.modelPath || '';
  document.getElementById('scale').value = currentSettings.appearance.scale || 1;
  document.getElementById('always-on-top').checked = currentSettings.appearance.alwaysOnTop !== false;
  
  // 人设
  document.getElementById('persona-preset').value = currentSettings.persona.preset || 'genki-girl';
  document.getElementById('persona-name').value = currentSettings.persona.name || '';
  document.getElementById('persona-personality').value = currentSettings.persona.personality || '';
  document.getElementById('persona-tone').value = currentSettings.persona.tone || '';
  document.getElementById('persona-catchphrase').value = currentSettings.persona.catchphrase || '';
  document.getElementById('persona-user-title').value = currentSettings.persona.userTitle || '';
  
  // 提醒
  document.getElementById('morningWork-enabled').checked = currentSettings.reminders.morningWork?.enabled !== false;
  document.getElementById('morningWork-time').value = currentSettings.reminders.morningWork?.time || '09:30';
  document.getElementById('morningWork-text').value = currentSettings.reminders.morningWork?.text || '新的一天开始啦，一起加油喵~';
  
  document.getElementById('lunch-enabled').checked = currentSettings.reminders.lunch?.enabled !== false;
  document.getElementById('lunch-time').value = currentSettings.reminders.lunch?.time || '12:00';
  document.getElementById('lunch-text').value = currentSettings.reminders.lunch?.text || '该吃午饭啦，记得好好休息哦~';
  
  document.getElementById('afternoonWork-enabled').checked = currentSettings.reminders.afternoonWork?.enabled !== false;
  document.getElementById('afternoonWork-time').value = currentSettings.reminders.afternoonWork?.time || '13:30';
  document.getElementById('afternoonWork-text').value = currentSettings.reminders.afternoonWork?.text || '午休结束啦，下午也要元气满满哦~';
  
  document.getElementById('offwork-enabled').checked = currentSettings.reminders.offwork?.enabled !== false;
  document.getElementById('offwork-time').value = currentSettings.reminders.offwork?.time || '19:30';
  document.getElementById('offwork-text').value = currentSettings.reminders.offwork?.text || '辛苦一天啦，回家好好休息吧~';
  
  document.getElementById('standup-enabled').checked = currentSettings.reminders.standup?.enabled !== false;
  document.getElementById('standup-interval').value = currentSettings.reminders.standup?.interval || 50;
  document.getElementById('standup-text').value = currentSettings.reminders.standup?.text || '站起来活动一下吧，伸个懒腰~';

  // 通用
  document.getElementById('auto-launch').checked = currentSettings.general?.autoLaunch !== false;
  
  // LLM
  document.getElementById('llm-enabled').checked = currentSettings.llm?.enabled || false;
  document.getElementById('llm-base-url').value = currentSettings.llm?.baseURL || 'https://api.openai.com/v1';
  document.getElementById('llm-api-key').value = currentSettings.llm?.apiKey || '';
  document.getElementById('llm-model').value = currentSettings.llm?.model || 'gpt-3.5-turbo';
}

// 从表单收集设置
function collectSettingsFromForm() {
  return {
    // configVersion 必须原样带回去：丢了会被当成旧配置，每次启动都被默认值覆盖掉用户改的提醒/模型
    configVersion: currentSettings.configVersion,
    appearance: {
      modelPath: document.getElementById('model-path').value,
      scale: parseFloat(document.getElementById('scale').value) || 1,
      alwaysOnTop: document.getElementById('always-on-top').checked
    },
    general: {
      ...currentSettings.general,
      autoLaunch: document.getElementById('auto-launch').checked
    },
    persona: {
      preset: document.getElementById('persona-preset').value,
      name: document.getElementById('persona-name').value,
      personality: document.getElementById('persona-personality').value,
      tone: document.getElementById('persona-tone').value,
      catchphrase: document.getElementById('persona-catchphrase').value,
      userTitle: document.getElementById('persona-user-title').value
    },
    reminders: {
      morningWork: {
        enabled: document.getElementById('morningWork-enabled').checked,
        time: document.getElementById('morningWork-time').value,
        text: document.getElementById('morningWork-text').value
      },
      lunch: {
        enabled: document.getElementById('lunch-enabled').checked,
        time: document.getElementById('lunch-time').value,
        text: document.getElementById('lunch-text').value
      },
      afternoonWork: {
        enabled: document.getElementById('afternoonWork-enabled').checked,
        time: document.getElementById('afternoonWork-time').value,
        text: document.getElementById('afternoonWork-text').value
      },
      offwork: {
        enabled: document.getElementById('offwork-enabled').checked,
        time: document.getElementById('offwork-time').value,
        text: document.getElementById('offwork-text').value
      },
      standup: {
        enabled: document.getElementById('standup-enabled').checked,
        interval: parseInt(document.getElementById('standup-interval').value) || 50,
        text: document.getElementById('standup-text').value
      },
      custom: currentSettings.reminders.custom || []
    },
    llm: {
      enabled: document.getElementById('llm-enabled').checked,
      baseURL: document.getElementById('llm-base-url').value,
      apiKey: document.getElementById('llm-api-key').value,
      model: document.getElementById('llm-model').value
    },
    windowPosition: currentSettings.windowPosition
  };
}

// 绑定事件
function bindEvents() {
  // Tab 切换
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const panelId = tab.dataset.panel;
      
      // 切换 tab 激活状态
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // 切换 panel 显示
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`panel-${panelId}`).classList.add('active');
    });
  });
  
  // 保存按钮
  document.getElementById('save-btn').addEventListener('click', async () => {
    const newSettings = collectSettingsFromForm();
    const saved = await window.desktopPet.setSettings(newSettings);
    if (saved) {
      currentSettings = newSettings;
      alert('设置已保存！');
    } else {
      // 不更新 currentSettings：没存上的值不能当作已生效的基线
      alert('保存失败：settings.json 当前无法解析，为保护原有配置未写入。\n同目录下的 settings.json.bad-* 是损坏前的备份，可用它恢复。');
    }
  });
  
  // 取消按钮
  document.getElementById('cancel-btn').addEventListener('click', () => {
    loadSettingsToForm();
  });
  
  // 测试 LLM 连接
  document.getElementById('test-llm').addEventListener('click', async () => {
    const statusDiv = document.getElementById('llm-status');
    statusDiv.className = 'status';
    statusDiv.textContent = '测试中...';
    
    try {
      const baseURL = document.getElementById('llm-base-url').value;
      const apiKey = document.getElementById('llm-api-key').value;
      const model = document.getElementById('llm-model').value;
      
      if (!apiKey) {
        throw new Error('请输入 API Key');
      }
      
      // 简单的测试请求
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5
        })
      });
      
      if (response.ok) {
        statusDiv.className = 'status success';
        statusDiv.textContent = '连接成功！';
      } else {
        const err = await response.text();
        throw new Error(`HTTP ${response.status}: ${err}`);
      }
    } catch (err) {
      statusDiv.className = 'status error';
      statusDiv.textContent = `连接失败：${err.message}`;
    }
  });
}

// 启动
init();
