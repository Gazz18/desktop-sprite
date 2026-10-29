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
// target 可以是窗口，也可以是返回当前窗口的 getter（主窗口重建后 getter 才能拿到新引用）
function triggerReminder(target, type, text) {
  const settings = store.getAll();
  const persona = settings.persona;
  
  // 生成人设化的提醒文案
  let reminderText = text;
  if (persona) {
    reminderText = `${persona.catchphrase} ${persona.userTitle}，${text}`;
  }
  
  // 只通过气泡提示，不弹系统通知
  const win = typeof target === 'function' ? target() : target;
  if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
    win.webContents.send('show-bubble', reminderText, type);
  }
}

// 检查提醒
function checkReminders(target) {
  const settings = store.getAll();
  const reminders = settings.reminders;
  
  // 早上上班提醒
  if (reminders.morningWork?.enabled && checkTimeMatch(reminders.morningWork.time)) {
    triggerReminder(target, 'morningWork', reminders.morningWork.text);
  }
  
  // 午饭提醒
  if (reminders.lunch?.enabled && checkTimeMatch(reminders.lunch.time)) {
    triggerReminder(target, 'lunch', reminders.lunch.text);
  }
  
  // 下午上班提醒
  if (reminders.afternoonWork?.enabled && checkTimeMatch(reminders.afternoonWork.time)) {
    triggerReminder(target, 'afternoonWork', reminders.afternoonWork.text);
  }
  
  // 下班提醒
  if (reminders.offwork?.enabled && checkTimeMatch(reminders.offwork.time)) {
    triggerReminder(target, 'offwork', reminders.offwork.text);
  }
  
  // 站立提醒（按间隔）
  if (reminders.standup?.enabled) {
    const now = Date.now();
    const intervalMs = (reminders.standup.interval || 50) * 60 * 1000;
    if (now - lastStandupTime >= intervalMs) {
      triggerReminder(target, 'standup', reminders.standup.text);
      lastStandupTime = now;
    }
  }
  
  // 自定义提醒
  if (reminders.custom && Array.isArray(reminders.custom)) {
    reminders.custom.forEach(reminder => {
      if (reminder.enabled && checkTimeMatch(reminder.time)) {
        triggerReminder(target, 'custom', reminder.text);
      }
    });
  }
}

// 启动提醒调度器
function startReminders(getWindow) {
  lastStandupTime = Date.now(); // 初始化站立提醒计时
  
  // 每 30 秒检查一次
  reminderInterval = setInterval(() => {
    checkReminders(getWindow);
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
