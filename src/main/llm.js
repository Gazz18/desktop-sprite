const store = require('./store');

// 对话历史（保留最近 20 条）
let chatHistory = [];

// 构建 system prompt
function buildSystemPrompt() {
  const persona = store.get('persona');
  if (!persona) return '你是住在桌面上的桌宠狸宝。';
  
  return `你是一只住在用户桌面上的桌宠，名字叫"${persona.name}"。
性格：${persona.personality}
说话语气：${persona.tone}
口头禅：${persona.catchphrase}
对用户的称呼：${persona.userTitle}

请用这个人设和用户对话，作为陪伴型桌宠保持软萌可爱，适当加入猫咪相关的动作描写（如摇尾巴、舔毛、蹭蹭等）。
回复必须简短：控制在两三句话以内、总字数不超过40字，一句话说清即可，不要长篇大论、不要罗列。`;
}

// 调用 LLM API
// 返回 { text, degraded, error }：degraded 标记是否走了本地兜底，避免 API 故障被"喵喵"掩盖
async function chat(userMessage) {
  const llmConfig = store.get('llm');

  // 未配置 LLM，用本地话术兜底
  if (!llmConfig?.enabled || !llmConfig?.apiKey) {
    return { text: getLocalResponse(userMessage), degraded: true, error: 'LLM 未启用或未配置 apiKey' };
  }

  // 添加用户消息到历史
  chatHistory.push({ role: 'user', content: userMessage });

  // 保留最近 20 条
  if (chatHistory.length > 20) {
    chatHistory = chatHistory.slice(-20);
  }

  try {
    const response = await fetch(`${llmConfig.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmConfig.apiKey}`
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          ...chatHistory
        ],
        max_tokens: 80,
        temperature: 0.8
      }),
      signal: AbortSignal.timeout(15000) // 15秒超时
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('LLM API error:', response.status, errText);
      // 移除刚加入的用户消息
      chatHistory.pop();
      return {
        text: getLocalResponse(userMessage),
        degraded: true,
        error: `HTTP ${response.status} ${errText.slice(0, 200)}`
      };
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      chatHistory.pop();
      return { text: getLocalResponse(userMessage), degraded: true, error: '响应中没有 content 字段' };
    }

    // 添加助手回复到历史
    chatHistory.push({ role: 'assistant', content: assistantMessage });

    return { text: assistantMessage, degraded: false, error: null };
  } catch (err) {
    console.error('LLM request failed:', err.message);
    chatHistory.pop();
    return { text: getLocalResponse(userMessage), degraded: true, error: err.message };
  }
}

// 本地话术兜底
function getLocalResponse(userInput) {
  const persona = store.get('persona') || {};
  const catchphrase = persona.catchphrase || '喵~';
  const userTitle = persona.userTitle || '主人';
  const lowerInput = userInput.toLowerCase();
  
  if (lowerInput.includes('你好') || lowerInput.includes('hi') || lowerInput.includes('hello')) {
    return `${catchphrase} ${userTitle}，你好呀~`;
  }
  if (lowerInput.includes('名字')) {
    return `${catchphrase} 我叫${persona.name || '小橘'}哦~`;
  }
  if (lowerInput.includes('吃') || lowerInput.includes('饭')) {
    return `${catchphrase} 记得按时吃饭哦！`;
  }
  if (lowerInput.includes('累') || lowerInput.includes('辛苦')) {
    return `${catchphrase} 辛苦啦，休息一下吧~ *蹭蹭*`;
  }
  if (lowerInput.includes('尾巴')) {
    return `${catchphrase} *尾巴摇得更欢快了*`;
  }
  
  const defaultResponses = [
    `${catchphrase} 嗯嗯，我在听~`,
    `${catchphrase} 喵呜~ *歪头*`,
    `${catchphrase} 然后呢？`,
    `${catchphrase} *蹭蹭* 有意思！`,
    `${catchphrase} 我懂我懂~ *甩尾巴*`
  ];
  
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

// 清空对话历史
function clearHistory() {
  chatHistory = [];
}

module.exports = { chat, clearHistory };
