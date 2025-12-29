/**
 * MCP Settings 前端邏輯
 * 負責 MCP Server 的管理和工具配置
 */

(function() {
    'use strict';

    const API_BASE = '';

    // DOM 元素
    const elements = {
        serverList: document.getElementById('serverList'),
        emptyState: document.getElementById('emptyState'),
        serverModal: document.getElementById('serverModal'),
        modalTitle: document.getElementById('modalTitle'),
        serverForm: document.getElementById('serverForm'),
        serverId: document.getElementById('serverId'),
        serverName: document.getElementById('serverName'),
        serverTransport: document.getElementById('serverTransport'),
        serverCommand: document.getElementById('serverCommand'),
        serverArgs: document.getElementById('serverArgs'),
        serverEnv: document.getElementById('serverEnv'),
        serverUrl: document.getElementById('serverUrl'),
        stdioFields: document.getElementById('stdioFields'),
        httpFields: document.getElementById('httpFields'),
        addServerBtn: document.getElementById('addServerBtn'),
        connectAllBtn: document.getElementById('connectAllBtn'),
        disconnectAllBtn: document.getElementById('disconnectAllBtn'),
        closeModal: document.getElementById('closeModal'),
        cancelBtn: document.getElementById('cancelBtn'),
        saveBtn: document.getElementById('saveBtn'),
        createSerenaBtn: document.getElementById('createSerenaBtn'),
        serenaProjectPath: document.getElementById('serenaProjectPath'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer')
    };

    // 狀態
    let servers = [];
    let socket = null;

    // 初始化
    function init() {
        loadServers();
        initEventListeners();
        initSocketEvents();
    }

    // 初始化 Socket.IO 事件
    function initSocketEvents() {
        if (typeof io === 'undefined') {
            console.warn('Socket.IO not available');
            return;
        }

        socket = io();

        socket.on('connect', () => {
            console.log('Socket.IO connected');
        });

        socket.on('mcp:server_connected', (data) => {
            console.log('MCP Server connected:', data);
            showToast(`${data.serverName} 已連接`, 'success');
            loadServers();
        });

        socket.on('mcp:server_disconnected', (data) => {
            console.log('MCP Server disconnected:', data);
            if (data.reason === 'unexpected') {
                showToast(`⚠️ ${data.serverName} 意外斷開`, 'warning');
            }
            loadServers();
        });

        socket.on('mcp:server_error', (data) => {
            console.error('MCP Server error:', data);
            showToast(`❌ ${data.serverName} 錯誤: ${data.error}`, 'error');
            loadServers();
        });

        socket.on('mcp:server_reconnecting', (data) => {
            console.log('MCP Server reconnecting:', data);
            showToast(`🔄 ${data.serverName} 正在重連 (${data.attempt}/${data.maxAttempts})`, 'info');
            loadServers();
        });

        socket.on('mcp:server_state_changed', (data) => {
            console.log('MCP Server state changed:', data);
            loadServers();
        });
    }

    // 載入 Server 列表
    async function loadServers() {
        try {
            const response = await fetch(`${API_BASE}/api/mcp-servers`);
            const data = await response.json();
            
            if (data.success) {
                servers = data.servers || [];
                renderServers();
            } else {
                showToast('載入 Server 列表失敗', 'error');
            }
        } catch (error) {
            console.error('Failed to load servers:', error);
            showToast('載入 Server 列表失敗', 'error');
        }
    }

    // 渲染 Server 列表
    function renderServers() {
        if (servers.length === 0) {
            elements.serverList.innerHTML = '';
            elements.emptyState.style.display = 'block';
            return;
        }

        elements.emptyState.style.display = 'none';
        elements.serverList.innerHTML = servers.map(server => renderServerCard(server)).join('');

        // 綁定事件
        bindServerEvents();
    }

    // 渲染單個 Server 卡片
    function renderServerCard(server) {
        const state = server.state || { status: 'disconnected', tools: [], resources: [], prompts: [] };
        const statusClass = state.status;
        const statusText = getStatusText(state.status);
        const tools = state.tools || [];
        const isReconnecting = state.status === 'reconnecting';
        const hasError = state.status === 'error' || state.lastError;

        return `
            <div class="server-card ${statusClass}" data-server-id="${server.id}">
                <div class="server-header">
                    <div class="server-info">
                        <span class="server-name">${escapeHtml(server.name)}</span>
                        <span class="server-status ${statusClass}">
                            <span class="status-dot"></span>
                            ${statusText}
                        </span>
                    </div>
                    <div class="server-actions">
                        ${state.status === 'connected' 
                            ? `<button class="btn btn-secondary btn-disconnect" data-id="${server.id}">斷開</button>`
                            : isReconnecting
                                ? `<button class="btn btn-warning btn-cancel-reconnect" data-id="${server.id}">取消重連</button>`
                                : `<button class="btn btn-success btn-connect" data-id="${server.id}">連接</button>`
                        }
                        ${hasError && !isReconnecting ? `<button class="btn btn-primary btn-retry" data-id="${server.id}">🔄 重試</button>` : ''}
                        <button class="btn btn-secondary btn-edit" data-id="${server.id}">編輯</button>
                        <button class="btn btn-danger btn-delete" data-id="${server.id}">刪除</button>
                    </div>
                </div>
                <div class="server-body">
                    <div class="server-details">
                        <div class="detail-item">
                            <span class="detail-label">傳輸方式</span>
                            <span class="detail-value">${server.transport}</span>
                        </div>
                        ${server.transport === 'stdio' ? `
                            <div class="detail-item">
                                <span class="detail-label">命令</span>
                                <span class="detail-value">${escapeHtml(server.command || '-')}</span>
                            </div>
                            ${server.args && server.args.length > 0 ? `
                                <div class="detail-item">
                                    <span class="detail-label">參數</span>
                                    <span class="detail-value">${escapeHtml(server.args.join(' '))}</span>
                                </div>
                            ` : ''}
                        ` : `
                            <div class="detail-item">
                                <span class="detail-label">URL</span>
                                <span class="detail-value">${escapeHtml(server.url || '-')}</span>
                            </div>
                        `}
                        ${hasError ? `
                            <div class="error-section" style="grid-column: 1 / -1;">
                                <div class="detail-item">
                                    <span class="detail-label" style="color: #ef4444;">⚠️ 錯誤</span>
                                    <span class="detail-value" style="color: #ef4444;">${escapeHtml(state.error || state.lastError)}</span>
                                </div>
                                ${state.lastErrorAt ? `
                                    <div class="detail-item">
                                        <span class="detail-label" style="color: #f97316;">發生時間</span>
                                        <span class="detail-value" style="color: #f97316;">${formatTime(state.lastErrorAt)}</span>
                                    </div>
                                ` : ''}
                                ${isReconnecting ? `
                                    <div class="detail-item">
                                        <span class="detail-label" style="color: #3b82f6;">重連狀態</span>
                                        <span class="detail-value" style="color: #3b82f6;">
                                            嘗試 ${state.reconnectAttempts || 0}/${state.maxReconnectAttempts || 3}
                                            ${state.nextReconnectAt ? ` - 下次重連: ${formatTime(state.nextReconnectAt)}` : ''}
                                        </span>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>

                    ${state.status === 'connected' && tools.length > 0 ? `
                        <div class="tools-section">
                            <div class="tools-header">
                                <span class="tools-title">🔧 工具列表</span>
                                <span class="tools-count">${tools.length} 個工具</span>
                            </div>
                            <div class="tools-grid">
                                ${tools.map(tool => renderToolItem(server.id, tool)).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // 格式化時間
    function formatTime(isoString) {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleString('zh-TW', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit'
        });
    }

    // 渲染工具項目
    function renderToolItem(serverId, tool) {
        const enabled = tool.enabled !== false;
        const encodedName = encodeURIComponent(tool.name);
        
        return `
            <div class="tool-item ${enabled ? '' : 'disabled'}">
                <input type="checkbox" class="tool-checkbox" 
                    data-server-id="${serverId}" 
                    data-tool-name="${encodedName}"
                    ${enabled ? 'checked' : ''}>
                <div class="tool-info">
                    <div class="tool-name">${escapeHtml(tool.name)}</div>
                    ${tool.description ? `<div class="tool-description">${escapeHtml(tool.description)}</div>` : ''}
                </div>
            </div>
        `;
    }

    // 獲取狀態文字
    function getStatusText(status) {
        const statusMap = {
            'connected': '已連接',
            'disconnected': '已斷開',
            'connecting': '連接中...',
            'reconnecting': '重連中...',
            'error': '錯誤'
        };
        return statusMap[status] || status;
    }

    // 初始化事件監聽
    function initEventListeners() {
        // 新增 Server
        elements.addServerBtn.addEventListener('click', () => openModal());

        // 全部連接
        elements.connectAllBtn.addEventListener('click', connectAll);

        // 全部斷開
        elements.disconnectAllBtn.addEventListener('click', disconnectAll);

        // 創建 Serena
        elements.createSerenaBtn.addEventListener('click', createSerena);

        // Modal 事件
        elements.closeModal.addEventListener('click', closeModal);
        elements.cancelBtn.addEventListener('click', closeModal);
        elements.saveBtn.addEventListener('click', saveServer);

        // 傳輸方式切換
        elements.serverTransport.addEventListener('change', (e) => {
            const isStdio = e.target.value === 'stdio';
            elements.stdioFields.style.display = isStdio ? 'block' : 'none';
            elements.httpFields.style.display = isStdio ? 'none' : 'block';
        });

        // 點擊 Modal 外部關閉
        elements.serverModal.addEventListener('click', (e) => {
            if (e.target === elements.serverModal) {
                closeModal();
            }
        });
    }

    // 綁定 Server 事件
    function bindServerEvents() {
        // 連接按鈕
        document.querySelectorAll('.btn-connect').forEach(btn => {
            btn.addEventListener('click', () => connectServer(parseInt(btn.dataset.id)));
        });

        // 斷開按鈕
        document.querySelectorAll('.btn-disconnect').forEach(btn => {
            btn.addEventListener('click', () => disconnectServer(parseInt(btn.dataset.id)));
        });

        // 編輯按鈕
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => editServer(parseInt(btn.dataset.id)));
        });

        // 刪除按鈕
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteServer(parseInt(btn.dataset.id)));
        });

        // 重試按鈕
        document.querySelectorAll('.btn-retry').forEach(btn => {
            btn.addEventListener('click', () => retryServer(parseInt(btn.dataset.id)));
        });

        // 取消重連按鈕
        document.querySelectorAll('.btn-cancel-reconnect').forEach(btn => {
            btn.addEventListener('click', () => cancelReconnect(parseInt(btn.dataset.id)));
        });

        // 工具啟用切換
        document.querySelectorAll('.tool-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const serverId = parseInt(e.target.dataset.serverId);
                const toolName = decodeURIComponent(e.target.dataset.toolName);
                const enabled = e.target.checked;
                toggleToolEnabled(serverId, toolName, enabled);
            });
        });
    }

    // 打開 Modal
    function openModal(server = null) {
        if (server) {
            elements.modalTitle.textContent = '編輯 MCP Server';
            elements.serverId.value = server.id;
            elements.serverName.value = server.name;
            elements.serverTransport.value = server.transport;
            elements.serverCommand.value = server.command || '';
            elements.serverArgs.value = (server.args || []).join('\n');
            elements.serverEnv.value = server.env ? JSON.stringify(server.env, null, 2) : '';
            elements.serverUrl.value = server.url || '';
        } else {
            elements.modalTitle.textContent = '新增 MCP Server';
            elements.serverId.value = '';
            elements.serverForm.reset();
            elements.serverEnv.value = '';
        }

        // 更新欄位顯示
        const isStdio = elements.serverTransport.value === 'stdio';
        elements.stdioFields.style.display = isStdio ? 'block' : 'none';
        elements.httpFields.style.display = isStdio ? 'none' : 'block';

        elements.serverModal.classList.add('active');
    }

    // 關閉 Modal
    function closeModal() {
        elements.serverModal.classList.remove('active');
    }

    // 儲存 Server
    async function saveServer() {
        const id = elements.serverId.value;
        const name = elements.serverName.value.trim();
        const transport = elements.serverTransport.value;
        const command = elements.serverCommand.value.trim();
        const argsText = elements.serverArgs.value.trim();
        const envText = elements.serverEnv.value.trim();
        const url = elements.serverUrl.value.trim();

        if (!name) {
            showToast('請輸入名稱', 'error');
            return;
        }

        if (transport === 'stdio' && !command) {
            showToast('stdio 傳輸方式需要指定命令', 'error');
            return;
        }

        if (transport !== 'stdio' && !url) {
            showToast(`${transport} 傳輸方式需要指定 URL`, 'error');
            return;
        }

        let env = {};
        if (envText) {
            try {
                env = JSON.parse(envText);
            } catch (e) {
                showToast('環境變數格式錯誤，請使用 JSON 格式', 'error');
                return;
            }
        }

        const args = argsText ? argsText.split('\n').map(a => a.trim()).filter(a => a) : [];

        const data = {
            name,
            transport,
            command: transport === 'stdio' ? command : undefined,
            args: transport === 'stdio' ? args : undefined,
            env: transport === 'stdio' && Object.keys(env).length > 0 ? env : undefined,
            url: transport !== 'stdio' ? url : undefined,
            enabled: true
        };

        showLoading(true);

        try {
            const endpoint = id ? `${API_BASE}/api/mcp-servers/${id}` : `${API_BASE}/api/mcp-servers`;
            const method = id ? 'PUT' : 'POST';

            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                showToast(id ? 'Server 更新成功' : 'Server 創建成功', 'success');
                closeModal();
                loadServers();
            } else {
                showToast(result.error || '操作失敗', 'error');
            }
        } catch (error) {
            console.error('Save server failed:', error);
            showToast('操作失敗', 'error');
        } finally {
            showLoading(false);
        }
    }

    // 連接 Server
    async function connectServer(id) {
        showLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/mcp-servers/${id}/connect`, {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                showToast('連接成功', 'success');
            } else {
                showToast(result.error || '連接失敗', 'error');
            }
            loadServers();
        } catch (error) {
            console.error('Connect failed:', error);
            showToast('連接失敗', 'error');
        } finally {
            showLoading(false);
        }
    }

    // 斷開 Server
    async function disconnectServer(id) {
        showLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/mcp-servers/${id}/disconnect`, {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                showToast('已斷開連接', 'success');
            } else {
                showToast(result.error || '斷開失敗', 'error');
            }
            loadServers();
        } catch (error) {
            console.error('Disconnect failed:', error);
            showToast('斷開失敗', 'error');
        } finally {
            showLoading(false);
        }
    }

    // 重試連接 Server
    async function retryServer(id) {
        showLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/mcp-servers/${id}/retry`, {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                showToast('重試連接成功', 'success');
            } else {
                showToast(result.error || '重試連接失敗', 'error');
            }
            loadServers();
        } catch (error) {
            console.error('Retry failed:', error);
            showToast('重試連接失敗', 'error');
        } finally {
            showLoading(false);
        }
    }

    // 取消自動重連
    async function cancelReconnect(id) {
        try {
            const response = await fetch(`${API_BASE}/api/mcp-servers/${id}/cancel-reconnect`, {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                showToast('已取消自動重連', 'info');
            } else {
                showToast(result.error || '取消失敗', 'error');
            }
            loadServers();
        } catch (error) {
            console.error('Cancel reconnect failed:', error);
            showToast('取消失敗', 'error');
        }
    }

    // 編輯 Server
    function editServer(id) {
        const server = servers.find(s => s.id === id);
        if (server) {
            openModal(server);
        }
    }

    // 刪除 Server
    async function deleteServer(id) {
        if (!confirm('確定要刪除此 Server 嗎？')) {
            return;
        }

        showLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/mcp-servers/${id}`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (result.success) {
                showToast('Server 已刪除', 'success');
                loadServers();
            } else {
                showToast(result.error || '刪除失敗', 'error');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            showToast('刪除失敗', 'error');
        } finally {
            showLoading(false);
        }
    }

    // 全部連接
    async function connectAll() {
        showLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/mcp-servers/connect-all`, {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                const successCount = result.results.filter(r => r.success).length;
                showToast(`連接完成：${successCount}/${result.results.length} 成功`, 'success');
                loadServers();
            } else {
                showToast(result.error || '連接失敗', 'error');
            }
        } catch (error) {
            console.error('Connect all failed:', error);
            showToast('連接失敗', 'error');
        } finally {
            showLoading(false);
        }
    }

    // 全部斷開
    async function disconnectAll() {
        showLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/mcp-servers/disconnect-all`, {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                showToast('已斷開所有連接', 'success');
                loadServers();
            } else {
                showToast(result.error || '斷開失敗', 'error');
            }
        } catch (error) {
            console.error('Disconnect all failed:', error);
            showToast('斷開失敗', 'error');
        } finally {
            showLoading(false);
        }
    }

    // 創建 Serena
    async function createSerena() {
        const projectPath = elements.serenaProjectPath.value.trim();

        showLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/mcp-presets/serena/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath, autoConnect: true })
            });
            const result = await response.json();

            if (result.success) {
                const state = result.server?.state;
                if (state?.status === 'connected') {
                    showToast(`Serena 創建並連接成功，共 ${state.tools?.length || 0} 個工具`, 'success');
                } else {
                    showToast(`Serena 創建成功，但連接失敗：${state?.error || '未知錯誤'}`, 'error');
                }
                loadServers();
            } else {
                showToast(result.error || '創建失敗', 'error');
            }
        } catch (error) {
            console.error('Create Serena failed:', error);
            showToast('創建 Serena 失敗', 'error');
        } finally {
            showLoading(false);
        }
    }

    // 切換工具啟用狀態
    async function toggleToolEnabled(serverId, toolName, enabled) {
        try {
            const response = await fetch(
                `${API_BASE}/api/mcp-servers/${serverId}/tools/${encodeURIComponent(toolName)}/enable`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled })
                }
            );
            const result = await response.json();

            if (!result.success) {
                showToast(result.error || '設定失敗', 'error');
                loadServers();
            }
        } catch (error) {
            console.error('Toggle tool failed:', error);
            showToast('設定失敗', 'error');
            loadServers();
        }
    }

    // 顯示/隱藏 Loading
    function showLoading(show) {
        elements.loadingOverlay.classList.toggle('active', show);
    }

    // 顯示 Toast
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // HTML 轉義
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 頁面載入完成後初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
