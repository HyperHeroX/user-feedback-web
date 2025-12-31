/**
 * conversation-panel.js
 * 對話面板元件 - 顯示 AI 對話流程
 * 支援 6 種對話條目類型: prompt, thinking, tool, result, ai, error
 */

import { escapeHtml } from './ui-helpers.js';

/**
 * 對話條目類型
 */
export const ConversationEntryType = {
  PROMPT: 'prompt',
  THINKING: 'thinking',
  TOOL: 'tool',
  RESULT: 'result',
  AI: 'ai',
  ERROR: 'error'
};

/**
 * 對話條目視覺配置
 */
const entryConfig = {
  prompt: {
    icon: '📤',
    title: '提示詞',
    className: 'entry-prompt',
    borderColor: 'var(--accent-blue)'
  },
  thinking: {
    icon: '🤔',
    title: 'AI 思考中',
    className: 'entry-thinking',
    borderColor: 'var(--accent-yellow)'
  },
  tool: {
    icon: '🔧',
    title: '工具呼叫',
    className: 'entry-tool',
    borderColor: 'var(--accent-purple, #a855f7)'
  },
  result: {
    icon: '📥',
    title: '工具結果',
    className: 'entry-result',
    borderColor: 'var(--accent-cyan, #06b6d4)'
  },
  ai: {
    icon: '🤖',
    title: 'AI 回覆',
    className: 'entry-ai',
    borderColor: 'var(--accent-green)'
  },
  error: {
    icon: '❌',
    title: '錯誤',
    className: 'entry-error',
    borderColor: 'var(--accent-red)'
  }
};

/**
 * 建立對話面板容器
 */
export function createConversationPanel() {
  const panel = document.createElement('div');
  panel.id = 'conversationPanel';
  panel.className = 'conversation-panel';
  panel.innerHTML = `
    <div class="conversation-header">
      <div class="conversation-title">
        <span class="icon">💬</span>
        <span id="conversationTitle">AI 對話</span>
      </div>
      <div class="conversation-mode">
        <span class="mode-indicator" id="conversationModeIndicator"></span>
        <span id="conversationMode">準備中</span>
      </div>
    </div>
    <div class="conversation-body" id="conversationBody">
      <!-- 對話條目會動態添加 -->
    </div>
    <div class="conversation-footer">
      <button type="button" id="closeConversation" class="btn btn-secondary">關閉</button>
    </div>
  `;
  return panel;
}

/**
 * 建立對話條目元素
 */
export function createConversationEntry(type, content, options = {}) {
  const config = entryConfig[type] || entryConfig.ai;
  const entry = document.createElement('div');
  entry.className = `conversation-entry ${config.className}`;
  entry.style.borderLeftColor = config.borderColor;

  const titleText = options.title || config.title;
  const collapsed = options.collapsed ?? (type === 'prompt' || type === 'tool');
  const timestamp = options.timestamp ? formatTimestamp(options.timestamp) : '';

  let contentHtml = '';
  if (typeof content === 'string') {
    contentHtml = `<pre class="entry-content">${escapeHtml(content)}</pre>`;
  } else if (content && typeof content === 'object') {
    contentHtml = `<pre class="entry-content">${escapeHtml(JSON.stringify(content, null, 2))}</pre>`;
  }

  entry.innerHTML = `
    <details ${collapsed ? '' : 'open'}>
      <summary class="entry-summary">
        <span class="entry-icon">${config.icon}</span>
        <span class="entry-title">${titleText}</span>
        ${timestamp ? `<span class="entry-timestamp">${timestamp}</span>` : ''}
        ${options.badge ? `<span class="entry-badge">${options.badge}</span>` : ''}
      </summary>
      <div class="entry-body">
        ${contentHtml}
      </div>
    </details>
  `;

  return entry;
}

/**
 * 新增對話條目到面板
 */
export function addConversationEntry(type, content, options = {}) {
  const body = document.getElementById('conversationBody');
  if (!body) return null;

  const entry = createConversationEntry(type, content, options);
  body.appendChild(entry);
  body.scrollTop = body.scrollHeight;

  return entry;
}

/**
 * 清空對話面板
 */
export function clearConversationPanel() {
  const body = document.getElementById('conversationBody');
  if (body) {
    body.innerHTML = '';
  }
}

/**
 * 更新對話面板模式顯示
 */
export function updateConversationMode(mode, cliTool = null) {
  const modeElement = document.getElementById('conversationMode');
  const indicator = document.getElementById('conversationModeIndicator');

  if (modeElement) {
    if (mode === 'cli' && cliTool) {
      modeElement.textContent = `CLI (${cliTool})`;
    } else if (mode === 'api') {
      modeElement.textContent = 'API';
    } else {
      modeElement.textContent = mode;
    }
  }

  if (indicator) {
    indicator.className = 'mode-indicator';
    if (mode === 'cli') {
      indicator.classList.add('mode-cli');
    } else if (mode === 'api') {
      indicator.classList.add('mode-api');
    }
  }
}

/**
 * 更新對話面板標題
 */
export function updateConversationTitle(title) {
  const titleElement = document.getElementById('conversationTitle');
  if (titleElement) {
    titleElement.textContent = title;
  }
}

/**
 * 顯示對話面板
 */
export function showConversationPanel() {
  let panel = document.getElementById('aiConversationPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'aiConversationPanel';
    panel.className = 'ai-conversation-overlay';
    panel.appendChild(createConversationPanel());
    document.body.appendChild(panel);

    const closeBtn = panel.querySelector('#closeConversation');
    if (closeBtn) {
      closeBtn.onclick = hideConversationPanel;
    }
  }
  panel.style.display = 'flex';
  clearConversationPanel();
}

/**
 * 隱藏對話面板
 */
export function hideConversationPanel() {
  const panel = document.getElementById('aiConversationPanel');
  if (panel) {
    panel.style.display = 'none';
  }
}

/**
 * 格式化時間戳記
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * 新增思考中動畫條目
 */
export function addThinkingEntry(message = 'AI 思考中...') {
  return addConversationEntry(ConversationEntryType.THINKING, message, {
    collapsed: false,
    badge: '⏳'
  });
}

/**
 * 移除思考中條目
 */
export function removeThinkingEntry() {
  const body = document.getElementById('conversationBody');
  if (!body) return;
  
  const thinkingEntries = body.querySelectorAll('.entry-thinking');
  thinkingEntries.forEach(entry => entry.remove());
}
