const store = require('./store');

let reminderInterval = null;
let lastStandupTime = 0;

// 检查时间是否匹配
function checkTimeMatch(targetTime) {
  const now = new Date();
  const [hours, minutes] = targetTime.split(':').map(Number);
  return now.getHours() === hours && now.getMinutes() === minutes;
}

// 触发提醒
function triggerReminder(mainWindow, type, text) {
  const settings = store.getAll();
  const persona = settings.persona;
  
  // 生成人设化的提醒文案
  let reminderText = text;
  if (persona) {
    reminderText = `${persona.catchphrase} ${persona.userTitle}，${text}`;
  }
  
  // 只通过气泡提示，不弹系统通知
  if (mainWindow) {
    mainWindow.webContents.send('show-bubble', reminderText, type);
  }
}

// 检查提醒
function checkReminders(mainWindow) {
  const settings = store.getAll();
  const reminders = settings.reminders;
  
  // 早上上班提醒
  if (reminders.morningWork?.enabled && checkTimeMatch(reminders.morningWork.time)) {
    triggerReminder(mainWindow, 'morningWork', reminders.morningWork.text);
  }
  
  // 午饭提醒
  if (reminders.lunch?.enabled && checkTimeMatch(reminders.lunch.time)) {
    triggerReminder(mainWindow, 'lunch', reminders.lunch.text);
  }
  
  // 下午上班提醒
  if (reminders.afternoonWork?.enabled && checkTimeMatch(reminders.afternoonWork.time)) {
    triggerReminder(mainWindow, 'afternoonWork', reminders.afternoonWork.text);
  }
  
  // 下班提醒
  if (reminders.offwork?.enabled && checkTimeMatch(reminders.offwork.time)) {
    triggerReminder(mainWindow, 'offwork', reminders.offwork.text);
  }
  
  // 站立提醒（按间隔）
  if (reminders.standup?.enabled) {
    const now = Date.now();
    const intervalMs = (reminders.standup.interval || 50) * 60 * 1000;
    if (now - lastStandupTime >= intervalMs) {
      triggerReminder(mainWindow, 'standup', reminders.standup.text);
      lastStandupTime = now;
    }
  }
  
  // 自定义提醒
  if (reminders.custom && Array.isArray(reminders.custom)) {
    reminders.custom.forEach(reminder => {
      if (reminder.enabled && checkTimeMatch(reminder.time)) {
        triggerReminder(mainWindow, 'custom', reminder.text);
      }
    });
  }
}

// 启动提醒调度器
function startReminders(mainWindow) {
  lastStandupTime = Date.now(); // 初始化站立提醒计时
  
  // 每 30 秒检查一次
  reminderInterval = setInterval(() => {
    checkReminders(mainWindow);
  }, 30000);
  
  console.log('Reminders started');
}

// 停止提醒调度器
function stopReminders() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  console.log('Reminders stopped');
}

module.exports = { startReminders, stopReminders };
