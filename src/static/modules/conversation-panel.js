/**
 * conversation-panel.js
 * 對話面板元件 - 顯示 AI 對話流程
 * 支援 7 種對話條目類型: prompt, thinking, tool, result, ai, error, debug
 */

import { escapeHtml } from './ui-helpers.js';

export const ConversationEntryType = {
  PROMPT: 'prompt',
  THINKING: 'thinking',
  TOOL: 'tool',
  RESULT: 'result',
  AI: 'ai',
  ERROR: 'error',
  DEBUG: 'debug'
};

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
  },
  debug: {
    icon: '🐛',
    title: 'Debug',
    className: 'entry-debug',
    borderColor: 'var(--accent-orange, #f97316)'
  }
};

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
      <div class="conversation-header-right">
        <div class="conversation-mode">
          <span class="mode-indicator" id="conversationModeIndicator"></span>
          <span id="conversationMode">準備中</span>
        </div>
        <label class="debug-toggle" title="顯示 Debug 資訊">
          <input type="checkbox" id="debugToggle">
          <span>🐛</span>
        </label>
      </div>
    </div>
    <div class="conversation-body" id="conversationBody"></div>
    <div class="conversation-footer">
      <button type="button" id="closeConversation" class="btn btn-secondary">關閉</button>
    </div>
  `;
  return panel;
}

export function createConversationEntry(type, content, options = {}) {
  const config = entryConfig[type] || entryConfig.ai;
  const entry = document.createElement('div');
  entry.className = `conversation-entry ${config.className}`;
  entry.style.borderLeftColor = config.borderColor;

  const titleText = options.title || config.title;
  const collapsed = options.collapsed ?? (type === 'prompt' || type === 'tool' || type === 'debug');
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
 * 建立 Debug 資訊條目（結構化表格）
 */
export function createDebugEntry(debugInfo, options = {}) {
  const config = entryConfig.debug;
  const entry = document.createElement('div');
  entry.className = `conversation-entry ${config.className}`;
  entry.style.borderLeftColor = config.borderColor;

  const titleText = options.title || config.title;
  const collapsed = options.collapsed ?? true;
  const timestamp = options.timestamp ? formatTimestamp(options.timestamp) : '';

  let bodyHtml = '<div class="debug-info-grid">';

  if (debugInfo.elapsedMs !== undefined) {
    bodyHtml += debugRow('⏱️ 耗時', `${debugInfo.elapsedMs} ms`);
  }
  if (debugInfo.model) {
    bodyHtml += debugRow('🧠 模型', debugInfo.model);
  }
  if (debugInfo.temperature !== undefined) {
    bodyHtml += debugRow('🌡️ Temperature', debugInfo.temperature);
  }
  if (debugInfo.maxTokens !== undefined) {
    bodyHtml += debugRow('📏 Max Tokens', debugInfo.maxTokens);
  }
  if (debugInfo.tokenEstimate !== undefined) {
    bodyHtml += debugRow('🔢 Token 預估', `~${debugInfo.tokenEstimate}`);
  }
  if (debugInfo.totalPromptLength !== undefined) {
    bodyHtml += debugRow('📐 Prompt 長度', `${debugInfo.totalPromptLength} chars`);
  }
  if (debugInfo.componentCount !== undefined) {
    bodyHtml += debugRow('🧩 組件數量', debugInfo.componentCount);
  }
  if (debugInfo.mcpToolsCount !== undefined) {
    bodyHtml += debugRow('🔧 MCP 工具數', debugInfo.mcpToolsCount);
  }

  bodyHtml += '</div>';

  if (debugInfo.sections && debugInfo.sections.length > 0) {
    bodyHtml += '<div class="debug-sections">';
    bodyHtml += '<div class="debug-section-title">📋 提示詞區段順序（實際送出）</div>';
    bodyHtml += '<table class="debug-table"><thead><tr><th>#</th><th>區段名稱</th><th>順序</th><th>長度</th></tr></thead><tbody>';
    debugInfo.sections.forEach((s, i) => {
      bodyHtml += `<tr><td>${i + 1}</td><td>${escapeHtml(s.name)}</td><td>${s.order}</td><td>${s.length} chars</td></tr>`;
    });
    bodyHtml += '</tbody></table></div>';
  }

  if (debugInfo.promptConfigs && debugInfo.promptConfigs.length > 0) {
    bodyHtml += '<div class="debug-sections">';
    bodyHtml += '<div class="debug-section-title">⚙️ 提示詞配置（設定值）</div>';
    bodyHtml += '<table class="debug-table"><thead><tr><th>ID</th><th>啟用</th><th>第一次</th><th>第二次</th></tr></thead><tbody>';
    debugInfo.promptConfigs.forEach(c => {
      const enabledIcon = c.enabled ? '✅' : '❌';
      bodyHtml += `<tr><td>${escapeHtml(c.id)}</td><td>${enabledIcon}</td><td>${c.firstOrder}</td><td>${c.secondOrder}</td></tr>`;
    });
    bodyHtml += '</tbody></table></div>';
  }

  if (debugInfo.error) {
    bodyHtml += `<div class="debug-error">❌ 錯誤: ${escapeHtml(debugInfo.error)}</div>`;
  }

  entry.innerHTML = `
    <details ${collapsed ? '' : 'open'}>
      <summary class="entry-summary">
        <span class="entry-icon">${config.icon}</span>
        <span class="entry-title">${titleText}</span>
        ${timestamp ? `<span class="entry-timestamp">${timestamp}</span>` : ''}
        ${options.badge ? `<span class="entry-badge">${options.badge}</span>` : ''}
      </summary>
      <div class="entry-body debug-body">
        ${bodyHtml}
      </div>
    </details>
  `;

  return entry;
}

function debugRow(label, value) {
  return `<div class="debug-row"><span class="debug-label">${label}</span><span class="debug-value">${escapeHtml(String(value))}</span></div>`;
}

export function addConversationEntry(type, content, options = {}) {
  const body = document.getElementById('conversationBody');
  if (!body) return null;

  const entry = createConversationEntry(type, content, options);
  body.appendChild(entry);
  body.scrollTop = body.scrollHeight;
  return entry;
}

export function addDebugEntry(debugInfo, options = {}) {
  const body = document.getElementById('conversationBody');
  if (!body) return null;

  const entry = createDebugEntry(debugInfo, options);
  body.appendChild(entry);
  body.scrollTop = body.scrollHeight;

  const debugToggle = document.getElementById('debugToggle');
  if (debugToggle && !debugToggle.checked) {
    entry.style.display = 'none';
  }

  return entry;
}

export function clearConversationPanel() {
  const body = document.getElementById('conversationBody');
  if (body) {
    body.innerHTML = '';
  }
}

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

export function updateConversationTitle(title) {
  const titleElement = document.getElementById('conversationTitle');
  if (titleElement) {
    titleElement.textContent = title;
  }
}

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

    const debugToggle = panel.querySelector('#debugToggle');
    if (debugToggle) {
      debugToggle.addEventListener('change', (e) => {
        const show = e.target.checked;
        panel.querySelectorAll('.entry-debug').forEach(el => {
          el.style.display = show ? '' : 'none';
        });
      });
    }
  }
  panel.style.display = 'flex';
  clearConversationPanel();
}

export function hideConversationPanel() {
  const panel = document.getElementById('aiConversationPanel');
  if (panel) {
    panel.style.display = 'none';
  }
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function addThinkingEntry(message = 'AI 思考中...') {
  return addConversationEntry(ConversationEntryType.THINKING, message, {
    collapsed: false,
    badge: '⏳'
  });
}

export function removeThinkingEntry() {
  const body = document.getElementById('conversationBody');
  if (!body) return;

  const thinkingEntries = body.querySelectorAll('.entry-thinking');
  thinkingEntries.forEach(entry => entry.remove());
}
