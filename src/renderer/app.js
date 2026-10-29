// 桌面精灵主逻辑
let widget = null;
let settings = null;
let live2dStage = null;
let idleMotionTimer = null;

async function init() {
  try {
    settings = await window.desktopPet.getSettings();

    // 模型源探活后再渲染，避免“透明窗口里什么也没有”的假死
    const modelPath = await pickModelPath(settings.appearance?.modelCandidates);
    if (modelPath) {
      await initLive2D(modelPath);
    } else {
      console.error('所有模型源都不可用');
    }

    initBubble();
    initChat();
    if (modelPath) scheduleIdleMotion();  // 空闲时随机/定时播放狸宝自带的动作

    // 点击输入框/猫以外的区域（如拖拽条、空白）→ 收起输入框
    document.addEventListener('click', (e) => {
      const box = document.getElementById('chat-input-container');
      if (box.classList.contains('show') && !box.contains(e.target)) hideInput();
    });

    setTimeout(() => {
      if (!modelPath) {
        showBubble('模型加载不出来…先跑一下 npm run fetch-models 或看看网络喵');
        return;
      }
      startIdleChat();  // 随机开场白，并进入待机闲聊循环（不再固定"你好呀~"）
    }, 1800);
  } catch (err) {
    console.error('Init failed:', err);
    showBubble('我这边出了点问题，打不起来了…');
  }
}

// l2d-widget 加载模型失败不会抛异常，只会画一只全透明的猫，看上去就是“没加载”。
// 因此先按候选顺序（本地内置 → 远程 CDN）用 fetch 探活，选第一个能拉到的。
async function probeModelSource(url, timeoutMs = 4000) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch (e) {
    console.warn('模型源探测失败:', url, e.message);
    return false;
  }
}

async function pickModelPath(candidates) {
  const list = Array.from(new Set([
    ...(Array.isArray(candidates) ? candidates : []),
    settings?.appearance?.modelPath
  ].filter(Boolean)));

  for (const p of list) {
    if (await probeModelSource(p)) {
      console.log('使用模型源:', p);
      return p;
    }
    console.warn('模型源不可用，跳过:', p);
  }
  return null;
}

// 输入框显隐（热点触发显示，其他情况收起）
function showInput() {
  const box = document.getElementById('chat-input-container');
  box.classList.add('show');
  const input = document.getElementById('chat-input');
  if (input) input.focus();
}
function hideInput() {
  document.getElementById('chat-input-container').classList.remove('show');
}

// Live2D 初始化
// l2d-widget 的 createWidget 只接收 config 一个参数，会自行创建 position:fixed
// 容器挂到 document.body，并忽略外部传入的 canvas。
async function initLive2D(modelPath) {
  const bodySnapshot = new Set(Array.from(document.body.children));

  widget = window.L2D_WIDGET.createWidget({
    position: 'bottom-left',
    size: 300,
    model: [{
      path: modelPath,
      tips: false  // 关闭内置蓝色 tips 气泡（需求2）
    }],
    menus: { items: [] }
  });

  const added = Array.from(document.body.children).filter(el => !bodySnapshot.has(el));
  const stage = added.find(el => el.querySelector('canvas'));

  if (stage) {
    // 需求5：保持 cat-white 原生白猫效果，不加任何调色滤镜
    stage.classList.add('l2d-root');  // 供 CSS 精准兜底隐藏残留蓝色浮层
    live2dStage = stage;

    // 需求：点击猫（热点）toggle 输入框 —— 已显示则收起，未显示则弹出
    stage.addEventListener('click', (e) => {
      e.stopPropagation();
      const box = document.getElementById('chat-input-container');
      if (box.classList.contains('show')) {
        hideInput();
      } else {
        showInput();
      }
    });

    // 需求1：气泡底部紧贴猫头顶 —— 依据模型真实渲染像素定位，
    // 而非 300px 画布盒高（模型头顶有透明留白，用盒高会虚高 ~100px）
    scheduleBubblePosition();
  } else {
    console.error('Live2D stage not found');
  }

  // 隐藏内置状态条等非 canvas 的独立浮层 DOM
  added.forEach(el => {
    if (el !== stage && !el.querySelector('canvas')) {
      el.style.display = 'none';
    }
  });
}

// 多次重试定位：模型淡入需要时间，过早测量会拿到空白/未就绪
function scheduleBubblePosition() {
  [600, 1200, 2000, 3000].forEach(ms => setTimeout(positionOverCat, ms));
}

// 扫描 canvas 真实可见像素，得到猫的包围盒（顶/左/右），
// 据此：① 气泡底部锚到猫头顶上方 1px。
// 注意：pixi getBounds()/300px 画布盒都 ≠ 可见猫身（含透明留白），只有像素准。
function positionOverCat() {
  const bubble = document.getElementById('bubble');
  const canvas = live2dStage && live2dStage.querySelector('canvas');
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const winH = window.innerHeight;

  try {
    const off = document.createElement('canvas');
    off.width = canvas.width;
    off.height = canvas.height;
    const octx = off.getContext('2d');
    octx.drawImage(canvas, 0, 0);
    const img = octx.getImageData(0, 0, off.width, off.height).data;
    const dpr = canvas.width / (canvas.clientWidth || rect.width) || 1;
    const W = off.width, H = off.height;

    let top = null;
    for (let y = 0; y < H; y++) {
      let rowCount = 0;
      for (let x = 0; x < W; x++) {
        if (img[(y * W + x) * 4 + 3] > 30) rowCount++;
      }
      // 首个"成行"不透明像素行 = 头顶（>=3 过滤零星噪声）
      if (top == null && rowCount >= 3) { top = y / dpr; break; }
    }
    if (top == null) return; // 整幅透明（尚未渲染），等下次重试

    // 从底部向上扫描，找猫脚底边（用于把输入框贴到猫下方）
    let bottom = null;
    for (let y = H - 1; y >= 0; y--) {
      let rowCount = 0;
      for (let x = 0; x < W; x++) {
        if (img[(y * W + x) * 4 + 3] > 30) rowCount++;
      }
      if (bottom == null && rowCount >= 3) { bottom = y / dpr; break; }
    }

    const catTop = rect.top + top;
    const catBottom = rect.top + bottom;
    if (bubble) bubble.style.bottom = `${Math.round(winH - catTop + 1)}px`;
    // 输入框贴到猫脚底：把"猫脚底→原框顶(≈winH-10-50)"这段间距减半
    const inputBox = document.getElementById('chat-input-container');
    if (inputBox && bottom != null) {
      const oldTop = winH - 10 - 50;                 // 原 bottom:10px、框高约50px 时的上边缘
      const newTop = Math.round((catBottom + oldTop) / 2); // 猫脚底与原框顶的中点 = 间距减半
      inputBox.style.bottom = 'auto';
      inputBox.style.top = `${newTop}px`;
    }
    console.log(`cat top=${Math.round(catTop)} bottom=${Math.round(catBottom)} bubbleBottom=${bubble && bubble.style.bottom} inputTop=${inputBox && inputBox.style.top}`);
  } catch (e) {
    console.warn('measure cat top failed:', e.message);
  }
}




// 气泡与主进程消息对接
function initBubble() {
  window.desktopPet.onShowBubble((text, type) => showBubble(text, null, type));
  window.desktopPet.onSettingsUpdated((newSettings) => {
    const modelChanged = newSettings.appearance.modelPath !== settings.appearance.modelPath;
    settings = newSettings;
    if (modelChanged) location.reload();
  });
}

// 聊天输入
function initChat() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');

  const send = async () => {
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.blur();
    hideInput();            // 发送后收起输入框，保持"只在热点出现"
    sendBtn.disabled = true;
    showBubble('我想想…', 30000);

    try {
      const result = await window.desktopPet.chat(text);
      if (result.degraded) {
        showBubble(`⚠️ 大模型没接上：${result.error}\n（先凑合这句）${result.text}`, 15000);
      } else {
        showBubble(result.text, 12000);
      }
    } catch (err) {
      console.error('Chat failed:', err);
      showBubble('呜…我这边通信断了，再试一次');
    } finally {
      sendBtn.disabled = false;
    }
  };

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    } else if (e.key === 'Escape') {
      hideInput();
    }
  });
}

// 动作系统：空闲时随机/定时播放模型自带的特殊动作（tororo 的 "" 动作组：01~08）
function scheduleIdleMotion() {
  // 动作文件异步加载，轮询直到 getMotions() 就绪再启动循环
  let tries = 0;
  const boot = () => {
    const groups = widget && widget.l2d && widget.l2d.getMotions ? widget.l2d.getMotions() : null;
    const special = groups && groups[''];
    if (special && special.length) {
      startIdleMotionLoop(special.length);
    } else if (tries++ < 10) {
      setTimeout(boot, 800);
    }
  };
  setTimeout(boot, 2500);
}

function startIdleMotionLoop(count) {
  const tick = () => {
    const idx = Math.floor(Math.random() * count);
    try {
      widget.l2d.playMotion('', idx);
      console.log(`idle motion -> index ${idx}`);
    } catch (e) {
      console.warn('playMotion failed:', e.message);
    }
    idleMotionTimer = setTimeout(tick, 6000 + Math.random() * 8000); // 6~14 秒随机一次
  };
  idleMotionTimer = setTimeout(tick, 4000); // 首个动作 4 秒后开始
}

init();