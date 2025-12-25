/**
 * CLI 終端機管理頁面
 */

// 狀態
let terminals = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadTerminals();
    setupEventListeners();
});

// 設置事件監聽器
function setupEventListeners() {
    document.getElementById('refreshBtn')?.addEventListener('click', loadTerminals);
    document.getElementById('closeLogsModal')?.addEventListener('click', closeLogsModal);
    
    // 點擊 modal 外部關閉
    document.getElementById('logsModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'logsModal') {
            closeLogsModal();
        }
    });
    
    // ESC 關閉 modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeLogsModal();
        }
    });
}

// 載入終端機列表
async function loadTerminals() {
    try {
        const response = await fetch('/api/cli/terminals');
        if (!response.ok) {
            throw new Error('載入終端機列表失敗');
        }
        
        terminals = await response.json();
        renderTerminals();
        updateStats();
    } catch (error) {
        console.error('載入終端機錯誤:', error);
        showToast('載入終端機列表失敗', 'error');
    }
}

// 渲染終端機列表
function renderTerminals() {
    const container = document.getElementById('terminalsList');
    
    if (!terminals || terminals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="icon">💻</span>
                <h3>尚無 CLI 終端機</h3>
                <p>當您使用 CLI 模式與 AI 互動時，終端機將在此顯示</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = terminals.map(terminal => createTerminalCard(terminal)).join('');
    
    // 綁定卡片事件
    terminals.forEach(terminal => {
        const viewLogsBtn = document.querySelector(`[data-view-logs="${terminal.id}"]`);
        const deleteBtn = document.querySelector(`[data-delete="${terminal.id}"]`);
        
        viewLogsBtn?.addEventListener('click', () => viewLogs(terminal.id, terminal.project_name));
        deleteBtn?.addEventListener('click', () => deleteTerminal(terminal.id));
    });
}

// 建立終端機卡片 HTML
function createTerminalCard(terminal) {
    const statusClass = getStatusClass(terminal.status);
    const statusText = getStatusText(terminal.status);
    const toolIcon = getToolIcon(terminal.tool_type);
    const lastActivity = formatTime(terminal.updated_at || terminal.created_at);
    
    return `
        <div class="terminal-card" id="terminal-${terminal.id}">
            <div class="terminal-header">
                <div class="terminal-info">
                    <h3>${escapeHtml(terminal.project_name || '未命名專案')}</h3>
                    <span class="tool-badge">${toolIcon} ${terminal.tool_type}</span>
                </div>
                <span class="terminal-status ${statusClass}">${statusText}</span>
            </div>
            
            <div class="terminal-details">
                <div class="detail-row">
                    <span class="detail-label">終端機 ID</span>
                    <span class="detail-value">${terminal.id.substring(0, 8)}...</span>
                </div>
                ${terminal.pid ? `
                <div class="detail-row">
                    <span class="detail-label">程序 PID</span>
                    <span class="detail-value">${terminal.pid}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                    <span class="detail-label">最後活動</span>
                    <span class="detail-value">${lastActivity}</span>
                </div>
            </div>
            
            <div class="terminal-actions">
                <button class="btn btn-secondary btn-sm" data-view-logs="${terminal.id}">
                    📋 查看日誌
                </button>
                <button class="btn btn-danger btn-sm" data-delete="${terminal.id}">
                    🗑️ 刪除
                </button>
            </div>
        </div>
    `;
}

// 取得狀態 CSS class
function getStatusClass(status) {
    const statusMap = {
        'running': 'running',
        'idle': 'idle',
        'error': 'error',
        'stopped': 'stopped'
    };
    return statusMap[status] || 'stopped';
}

// 取得狀態顯示文字
function getStatusText(status) {
    const statusMap = {
        'running': '🔄 運行中',
        'idle': '🟢 閒置',
        'error': '❌ 錯誤',
        'stopped': '⏹️ 已停止'
    };
    return statusMap[status] || '未知';
}

// 取得工具圖示
function getToolIcon(toolType) {
    const iconMap = {
        'gemini': '🌟',
        'claude': '🤖',
        'openai-codex': '🔮'
    };
    return iconMap[toolType] || '💻';
}

// 更新統計數據
function updateStats() {
    const total = terminals.length;
    const active = terminals.filter(t => t.status === 'running' || t.status === 'idle').length;
    const errors = terminals.filter(t => t.status === 'error').length;
    
    document.getElementById('totalTerminals').textContent = total;
    document.getElementById('activeTerminals').textContent = active;
    document.getElementById('errorTerminals').textContent = errors;
}

// 查看執行日誌
async function viewLogs(terminalId, projectName) {
    try {
        const response = await fetch(`/api/cli/terminals/${terminalId}/logs`);
        if (!response.ok) {
            throw new Error('載入日誌失敗');
        }
        
        const logs = await response.json();
        showLogsModal(logs, projectName);
    } catch (error) {
        console.error('載入日誌錯誤:', error);
        showToast('載入執行日誌失敗', 'error');
    }
}

// 顯示日誌 Modal
function showLogsModal(logs, projectName) {
    const modal = document.getElementById('logsModal');
    const title = document.getElementById('logsModalTitle');
    const body = document.getElementById('logsModalBody');
    
    title.textContent = `執行日誌 - ${projectName || '未命名專案'}`;
    
    if (!logs || logs.length === 0) {
        body.innerHTML = `
            <div class="empty-state">
                <span class="icon">📋</span>
                <h3>尚無執行日誌</h3>
                <p>此終端機尚未有任何執行記錄</p>
            </div>
        `;
    } else {
        body.innerHTML = logs.map(log => createLogEntry(log)).join('');
    }
    
    modal.classList.add('show');
}

// 建立日誌條目 HTML
function createLogEntry(log) {
    const statusClass = log.success ? 'success' : 'error';
    const time = formatTime(log.executed_at);
    const duration = log.execution_time ? `${log.execution_time}ms` : 'N/A';
    
    return `
        <div class="log-entry ${statusClass}">
            <div class="log-meta">
                <span>🕐 ${time}</span>
                <span>⏱️ ${duration}</span>
            </div>
            <div class="log-prompt">
                <strong>提示:</strong> ${escapeHtml(truncateText(log.prompt, 200))}
            </div>
            <div class="log-response">
                <strong>回應:</strong> ${escapeHtml(truncateText(log.response || log.error_message || '無回應', 500))}
            </div>
        </div>
    `;
}

// 關閉日誌 Modal
function closeLogsModal() {
    const modal = document.getElementById('logsModal');
    modal.classList.remove('show');
}

// 刪除終端機
async function deleteTerminal(terminalId) {
    if (!confirm('確定要刪除此終端機嗎？相關的執行日誌也會被刪除。')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/cli/terminals/${terminalId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('刪除終端機失敗');
        }
        
        showToast('終端機已刪除', 'success');
        loadTerminals();
    } catch (error) {
        console.error('刪除終端機錯誤:', error);
        showToast('刪除終端機失敗', 'error');
    }
}

// 格式化時間
function formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // 1 分鐘內
    if (diff < 60000) {
        return '剛才';
    }
    
    // 1 小時內
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} 分鐘前`;
    }
    
    // 24 小時內
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} 小時前`;
    }
    
    // 超過 24 小時
    return date.toLocaleString('zh-TW', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 截斷文字
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// HTML 轉義
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 顯示 Toast 通知
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
