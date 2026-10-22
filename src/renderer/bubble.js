// 气泡对话逻辑 - 单气泡模式，不会堆叠
let bubbleTimer = null;
const BUBBLE_DURATION = 4000; // 默认 4 秒后自动消失

// 待机随机文案：狸宝平时无聊时自己冒的话
const IDLE_PHRASES = [
  '喵~ 好无聊呀，陪我说说话嘛',
  '(伸个懒腰) 喵呜~',
  '主人主人，摸摸我的头嘛',
  '今天也要元气满满哦~',
  '尾巴摇一摇，心情刚刚好',
  '打个小盹儿…zzZ',
  '要不要一起摸鱼呀~',
  '喵喵？你在忙什么呀',
  '记得喝口水、休息一下眼睛哦',
  '(舔舔爪子) 本喵今天也很可爱',
  '蹭蹭你~',
  '有我在，工作不孤单喵'
];
let idleTimer = null;

function pickIdleText() {
  return IDLE_PHRASES[Math.floor(Math.random() * IDLE_PHRASES.length)];
}

// 排下一次待机气泡：随机间隔，避免像定时器一样机械
function scheduleNextIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    showBubble(pickIdleText());
  }, 8000 + Math.random() * 12000); // 8~20 秒后冒一句
}

// 显示气泡（新气泡直接替换旧气泡）
// type: 'reminder' 表示定时提醒，样式更醒目、显示时间更长
function showBubble(text, duration, type) {
  const bubble = document.getElementById('bubble');
  const isReminder = type === 'reminder' || type === 'morningWork' || type === 'lunch' || type === 'afternoonWork' || type === 'offwork' || type === 'standup';
  const dur = duration || (isReminder ? 8000 : BUBBLE_DURATION);

  // 有消息进来时，取消待机的定时器，避免中途被待机文案打断
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  // 清除之前的定时器
  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
    bubbleTimer = null;
  }

  // 直接替换内容，不堆叠
  bubble.textContent = text;
  bubble.classList.remove('hidden');
  // 提醒类型加 .reminder class，让样式更醒目
  if (isReminder) {
    bubble.classList.add('reminder');
  } else {
    bubble.classList.remove('reminder');
  }
  bubble.style.opacity = '1';
  bubble.style.transform = 'translateX(-50%) translateY(0)';

  // 自动隐藏，隐藏后再排下一条待机文案
  bubbleTimer = setTimeout(() => {
    bubble.style.opacity = '0';       // 必须用内联覆盖，否则盖不住 showBubble 设的内联 opacity:1
    bubble.classList.add('hidden');
    bubbleTimer = null;
    scheduleNextIdle();
  }, dur);
}

// 隐藏气泡
function hideBubble() {
  const bubble = document.getElementById('bubble');
  bubble.style.opacity = '0';
  bubble.classList.add('hidden');

  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
    bubbleTimer = null;
  }
}

// 启动待机闲聊（首次也用随机文案，而非固定问候）
function startIdleChat() {
  showBubble(pickIdleText());
}

// 导出到全局
window.showBubble = showBubble;
window.hideBubble = hideBubble;
window.startIdleChat = startIdleChat;
