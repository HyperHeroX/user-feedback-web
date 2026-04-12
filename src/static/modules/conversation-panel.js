/**
 * conversation-panel.js
 * AI Console - 現代化對話面板
 * 支援即時對話流、歷史記錄瀏覽、完整 Debug 資訊
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

const ENTRY_CONFIG = {
  prompt:   { icon: '📤', label: '提示詞',   cls: 'entry-prompt',   color: 'var(--console-blue, #3b82f6)' },
  thinking: { icon: '🤔', label: 'AI 思考中', cls: 'entry-thinking', color: 'var(--console-yellow, #eab308)' },
  tool:     { icon: '🔧', label: '工具呼叫',   cls: 'entry-tool',     color: 'var(--console-purple, #a855f7)' },
  result:   { icon: '📥', label: '工具結果',   cls: 'entry-result',   color: 'var(--console-cyan, #06b6d4)' },
  ai:       { icon: '🤖', label: 'AI 回覆',   cls: 'entry-ai',       color: 'var(--console-green, #22c55e)' },
  error:    { icon: '❌', label: '錯誤',       cls: 'entry-error',    color: 'var(--console-red, #ef4444)' },
  debug:    { icon: '🐛', label: 'Debug',      cls: 'entry-debug',    color: 'var(--console-orange, #f97316)' }
};

const MAX_HISTORY = 50;
let conversationHistory = [];
let currentSession = null;
let activeTab = 'live';
let debugVisible = false;

function newSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function ts() {
  return new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function buildPanel() {
  const el = document.createElement('div');
  el.id = 'aiConsoleOverlay';
  el.className = 'ai-console-overlay';
  el.innerHTML = `
    <div class="ai-console">
      <header class="console-header">
        <div class="console-title-group">
          <span class="console-logo">⚡</span>
          <h2 class="console-title" id="consoleTitle">AI Console</h2>
          <span class="console-mode-badge" id="consoleBadge">準備中</span>
        </div>
        <div class="console-actions">
          <div class="console-tabs">
            <button class="tab-btn active" data-tab="live">即時</button>
            <button class="tab-btn" data-tab="history">歷史 <span class="history-count" id="historyCount">0</span></button>
          </div>
          <label class="debug-switch" title="Debug 模式">
            <input type="checkbox" id="consoleDebugToggle">
            <span class="debug-switch-track"><span class="debug-switch-thumb"></span></span>
            <span class="debug-switch-label">Debug</span>
          </label>
          <button class="console-close-btn" id="consoleCloseBtn" title="關閉">&times;</button>
        </div>
      </header>
      <div class="console-body">
        <div class="console-tab-content active" id="tabLive">
          <div class="live-entries" id="liveEntries"></div>
        </div>
        <div class="console-tab-content" id="tabHistory">
          <div class="history-list" id="historyList"></div>
        </div>
      </div>
      <footer class="console-footer">
        <div class="console-stats" id="consoleStats"></div>
        <button class="console-btn-close" id="consoleFooterClose">關閉</button>
      </footer>
    </div>`;
  return el;
}

function getOrCreatePanel() {
  let overlay = document.getElementById('aiConsoleOverlay');
  if (!overlay) {
    overlay = buildPanel();
    document.body.appendChild(overlay);
    bindEvents(overlay);
  }
  return overlay;
}

function bindEvents(overlay) {
  overlay.querySelector('#consoleCloseBtn').onclick = hideConversationPanel;
  overlay.querySelector('#consoleFooterClose').onclick = hideConversationPanel;

  overlay.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });

  const toggle = overlay.querySelector('#consoleDebugToggle');
  toggle.addEventListener('change', (e) => {
    debugVisible = e.target.checked;
    overlay.querySelectorAll('.entry-debug').forEach(el => {
      el.style.display = debugVisible ? '' : 'none';
    });
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideConversationPanel();
  });
}

function switchTab(tab) {
  activeTab = tab;
  const overlay = document.getElementById('aiConsoleOverlay');
  if (!overlay) return;

  overlay.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  overlay.querySelector('#tabLive').classList.toggle('active', tab === 'live');
  overlay.querySelector('#tabHistory').classList.toggle('active', tab === 'history');

  if (tab === 'history') renderHistory();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  list.innerHTML = '';

  if (conversationHistory.length === 0) {
    list.innerHTML = '<div class="history-empty">尚無歷史記錄</div>';
    return;
  }

  conversationHistory.slice().reverse().forEach(session => {
    const card = document.createElement('div');
    card.className = 'history-card';

    const hasError = session.entries.some(e => e.type === 'error');
    const statusIcon = hasError ? '❌' : '✅';
    const entryCount = session.entries.length;
    const debugEntry = session.entries.find(e => e.type === 'debug');
    const elapsed = debugEntry?.data?.elapsedMs;

    card.innerHTML = `
      <div class="history-card-header">
        <span class="history-status">${statusIcon}</span>
        <span class="history-session-title">${escapeHtml(session.title)}</span>
        <span class="history-time">${session.startTime}</span>
      </div>
      <div class="history-card-meta">
        <span class="history-meta-item">📊 ${entryCount} 筆</span>
        <span class="history-meta-item">${session.mode || '—'}</span>
        ${elapsed ? `<span class="history-meta-item">⏱ ${elapsed}ms</span>` : ''}
      </div>
      <div class="history-card-entries" style="display:none;"></div>
    `;

    card.querySelector('.history-card-header').onclick = () => {
      const body = card.querySelector('.history-card-entries');
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : '';
      if (!open && body.childElementCount === 0) {
        session.entries.forEach(e => {
          body.appendChild(renderEntry(e.type, e.content, e.options, e.data));
        });
      }
    };

    list.appendChild(card);
  });
}

function renderEntry(type, content, options = {}, debugData = null) {
  const cfg = ENTRY_CONFIG[type] || ENTRY_CONFIG.ai;
  const el = document.createElement('div');
  el.className = `console-entry ${cfg.cls}`;
  el.style.setProperty('--entry-accent', cfg.color);

  if (type === 'debug' && debugData) {
    el.innerHTML = buildDebugHtml(debugData, options);
    if (!debugVisible) el.style.display = 'none';
    return el;
  }

  const titleText = options.title || cfg.label;
  const collapsed = options.collapsed ?? (type === 'prompt' || type === 'tool');
  const time = options.timestamp ? ts() : '';

  let bodyHtml = '';
  if (typeof content === 'string') {
    bodyHtml = `<pre class="entry-code">${escapeHtml(content)}</pre>`;
  } else if (content && typeof content === 'object') {
    bodyHtml = `<pre class="entry-code">${escapeHtml(JSON.stringify(content, null, 2))}</pre>`;
  }

  el.innerHTML = `
    <details ${collapsed ? '' : 'open'}>
      <summary class="entry-row">
        <span class="entry-chevron"></span>
        <span class="entry-dot"></span>
        <span class="entry-icon">${cfg.icon}</span>
        <span class="entry-title">${escapeHtml(titleText)}</span>
        <span class="entry-spacer"></span>
        ${options.badge ? `<span class="entry-badge">${escapeHtml(String(options.badge))}</span>` : ''}
        ${time ? `<span class="entry-time">${time}</span>` : ''}
      </summary>
      <div class="entry-body">${bodyHtml}</div>
    </details>`;
  return el;
}

function buildDebugHtml(debugInfo, options = {}) {
  const time = options.timestamp ? ts() : '';
  const titleText = options.title || 'Debug';
  const collapsed = options.collapsed ?? true;

  const rows = [];
  if (debugInfo.elapsedMs !== undefined) rows.push(['⏱️ 耗時', `${debugInfo.elapsedMs} ms`]);
  if (debugInfo.model) rows.push(['🧠 模型', debugInfo.model]);
  if (debugInfo.temperature !== undefined) rows.push(['🌡️ Temperature', debugInfo.temperature]);
  if (debugInfo.maxTokens !== undefined) rows.push(['📏 Max Tokens', debugInfo.maxTokens]);
  if (debugInfo.tokenEstimate !== undefined) rows.push(['🔢 Token 預估', `~${debugInfo.tokenEstimate}`]);
  if (debugInfo.totalPromptLength !== undefined) rows.push(['📐 Prompt 長度', `${debugInfo.totalPromptLength} chars`]);
  if (debugInfo.componentCount !== undefined) rows.push(['🧩 組件數量', debugInfo.componentCount]);
  if (debugInfo.mcpToolsCount !== undefined) rows.push(['🔧 MCP 工具數', debugInfo.mcpToolsCount]);

  let grid = '<div class="dbg-grid">' + rows.map(([k, v]) =>
    `<div class="dbg-cell"><span class="dbg-key">${k}</span><span class="dbg-val">${escapeHtml(String(v))}</span></div>`
  ).join('') + '</div>';

  if (debugInfo.sections?.length) {
    grid += `<div class="dbg-section-title">📋 提示詞區段順序（實際送出）</div>
      <table class="dbg-table"><thead><tr><th>#</th><th>區段名稱</th><th>順序</th><th>長度</th></tr></thead><tbody>` +
      debugInfo.sections.map((s, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(s.name)}</td><td>${s.order}</td><td>${s.length} chars</td></tr>`).join('') +
      '</tbody></table>';
  }

  if (debugInfo.promptConfigs?.length) {
    grid += `<div class="dbg-section-title">⚙️ 提示詞配置（設定值）</div>
      <table class="dbg-table"><thead><tr><th>ID</th><th>啟用</th><th>第一次</th><th>第二次</th></tr></thead><tbody>` +
      debugInfo.promptConfigs.map(c =>
        `<tr><td>${escapeHtml(c.id)}</td><td>${c.enabled ? '✅' : '❌'}</td><td>${c.firstOrder}</td><td>${c.secondOrder}</td></tr>`
      ).join('') +
      '</tbody></table>';
  }

  if (debugInfo.error) {
    grid += `<div class="dbg-error">❌ ${escapeHtml(debugInfo.error)}</div>`;
  }

  return `
    <details ${collapsed ? '' : 'open'}>
      <summary class="entry-row">
        <span class="entry-chevron"></span>
        <span class="entry-dot"></span>
        <span class="entry-icon">🐛</span>
        <span class="entry-title">${escapeHtml(titleText)}</span>
        <span class="entry-spacer"></span>
        ${options.badge ? `<span class="entry-badge">${escapeHtml(String(options.badge))}</span>` : ''}
        ${time ? `<span class="entry-time">${time}</span>` : ''}
      </summary>
      <div class="entry-body dbg-body">${grid}</div>
    </details>`;
}

function saveCurrentSession() {
  if (!currentSession || currentSession.entries.length === 0) return;
  conversationHistory.push({ ...currentSession });
  if (conversationHistory.length > MAX_HISTORY) conversationHistory.shift();
  updateHistoryCount();
}

function updateHistoryCount() {
  const el = document.getElementById('historyCount');
  if (el) el.textContent = conversationHistory.length;
}

function updateStats() {
  const el = document.getElementById('consoleStats');
  if (!el || !currentSession) return;
  const count = currentSession.entries.length;
  const debugEntry = currentSession.entries.find(e => e.type === 'debug');
  const elapsed = debugEntry?.data?.elapsedMs;
  let text = `${count} 筆記錄`;
  if (elapsed) text += ` · ${elapsed}ms`;
  if (currentSession.mode) text += ` · ${currentSession.mode}`;
  el.textContent = text;
}

// ─── Public API (backward-compatible) ───

export function createConversationPanel() {
  return buildPanel().querySelector('.ai-console');
}

export function createConversationEntry(type, content, options = {}) {
  return renderEntry(type, content, options);
}

export function createDebugEntry(debugInfo, options = {}) {
  return renderEntry('debug', null, options, debugInfo);
}

export function addConversationEntry(type, content, options = {}) {
  const container = document.getElementById('liveEntries');
  if (!container) return null;

  const entry = renderEntry(type, content, options);
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;

  if (currentSession) {
    currentSession.entries.push({ type, content, options, data: null });
  }
  updateStats();
  return entry;
}

export function addDebugEntry(debugInfo, options = {}) {
  const container = document.getElementById('liveEntries');
  if (!container) return null;

  const entry = renderEntry('debug', null, options, debugInfo);
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;

  if (currentSession) {
    currentSession.entries.push({ type: 'debug', content: null, options, data: debugInfo });
  }
  updateStats();
  return entry;
}

export function clearConversationPanel() {
  const container = document.getElementById('liveEntries');
  if (container) container.innerHTML = '';
}

export function updateConversationMode(mode, cliTool = null) {
  const badge = document.getElementById('consoleBadge');
  if (!badge) return;

  let text = mode;
  if (mode === 'cli' && cliTool) text = `CLI (${cliTool})`;
  else if (mode === 'api') text = 'API';
  badge.textContent = text;
  badge.className = 'console-mode-badge mode-' + (mode === 'cli' ? 'cli' : mode === 'api' ? 'api' : 'pending');

  if (currentSession) {
    currentSession.mode = text;
  }
}

export function updateConversationTitle(title) {
  const el = document.getElementById('consoleTitle');
  if (el) el.textContent = title;
  if (currentSession) currentSession.title = title;
}

export function showConversationPanel() {
  const overlay = getOrCreatePanel();
  overlay.style.display = 'flex';

  saveCurrentSession();
  currentSession = {
    id: newSessionId(),
    title: 'AI Console',
    mode: '',
    startTime: ts(),
    entries: []
  };

  clearConversationPanel();
  switchTab('live');
  updateHistoryCount();
  updateStats();
}

export function hideConversationPanel() {
  const overlay = document.getElementById('aiConsoleOverlay');
  if (overlay) overlay.style.display = 'none';
}

export function addThinkingEntry(message = 'AI 思考中...') {
  return addConversationEntry(ConversationEntryType.THINKING, message, {
    collapsed: false,
    badge: '⏳'
  });
}

export function removeThinkingEntry() {
  const container = document.getElementById('liveEntries');
  if (!container) return;
  container.querySelectorAll('.entry-thinking').forEach(el => el.remove());
  if (currentSession) {
    currentSession.entries = currentSession.entries.filter(e => e.type !== 'thinking');
  }
}
