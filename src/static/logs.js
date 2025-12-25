/**
 * 系統日誌頁面
 */

(function() {
    'use strict';

    const API_BASE = '';
    const PAGE_SIZE = 50;

    let currentPage = 1;
    let currentFilters = {
        level: '',
        source: ''
    };
    let totalLogs = 0;

    const elements = {
        logsTableBody: document.getElementById('logsTableBody'),
        levelFilter: document.getElementById('levelFilter'),
        sourceFilter: document.getElementById('sourceFilter'),
        refreshBtn: document.getElementById('refreshBtn'),
        clearBtn: document.getElementById('clearBtn'),
        prevPageBtn: document.getElementById('prevPageBtn'),
        nextPageBtn: document.getElementById('nextPageBtn'),
        pageInfo: document.getElementById('pageInfo')
    };

    function init() {
        setupEventListeners();
        loadSources();
        loadLogs();
    }

    function setupEventListeners() {
        elements.levelFilter.addEventListener('change', () => {
            currentFilters.level = elements.levelFilter.value;
            currentPage = 1;
            loadLogs();
        });

        elements.sourceFilter.addEventListener('change', () => {
            currentFilters.source = elements.sourceFilter.value;
            currentPage = 1;
            loadLogs();
        });

        elements.refreshBtn.addEventListener('click', () => {
            loadLogs();
        });

        elements.clearBtn.addEventListener('click', () => {
            if (confirm('確定要清除所有日誌嗎？此操作無法復原。')) {
                clearLogs();
            }
        });

        elements.prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadLogs();
            }
        });

        elements.nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalLogs / PAGE_SIZE);
            if (currentPage < totalPages) {
                currentPage++;
                loadLogs();
            }
        });
    }

    async function loadSources() {
        try {
            const response = await fetch(`${API_BASE}/api/logs/sources`);
            const data = await response.json();
            
            if (data.sources && data.sources.length > 0) {
                elements.sourceFilter.innerHTML = '<option value="">全部</option>' +
                    data.sources.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
            }
        } catch (error) {
            console.error('Failed to load sources:', error);
        }
    }

    async function loadLogs() {
        try {
            const params = new URLSearchParams({
                page: currentPage,
                pageSize: PAGE_SIZE
            });

            if (currentFilters.level) {
                params.append('level', currentFilters.level);
            }
            if (currentFilters.source) {
                params.append('source', currentFilters.source);
            }

            const response = await fetch(`${API_BASE}/api/logs?${params}`);
            const data = await response.json();

            totalLogs = data.total || 0;
            renderLogs(data.logs || []);
            updatePagination();
        } catch (error) {
            console.error('Failed to load logs:', error);
            showError('載入日誌失敗');
        }
    }

    function renderLogs(logs) {
        if (logs.length === 0) {
            elements.logsTableBody.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="empty-logs">
                            <div class="icon">📭</div>
                            <p>沒有日誌記錄</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        elements.logsTableBody.innerHTML = logs.map(log => `
            <tr>
                <td class="log-timestamp">${formatTimestamp(log.timestamp)}</td>
                <td><span class="log-level ${log.level}">${log.level}</span></td>
                <td class="log-source">${escapeHtml(log.source || '-')}</td>
                <td class="log-message" title="${escapeHtml(log.message)}">${escapeHtml(log.message)}</td>
            </tr>
        `).join('');
    }

    function updatePagination() {
        const totalPages = Math.ceil(totalLogs / PAGE_SIZE);
        
        elements.prevPageBtn.disabled = currentPage <= 1;
        elements.nextPageBtn.disabled = currentPage >= totalPages || totalPages === 0;
        elements.pageInfo.textContent = `第 ${currentPage} 頁 / 共 ${totalPages} 頁 (總計 ${totalLogs} 條)`;
    }

    async function clearLogs() {
        try {
            const response = await fetch(`${API_BASE}/api/logs`, {
                method: 'DELETE'
            });

            if (response.ok) {
                currentPage = 1;
                loadLogs();
            } else {
                showError('清除日誌失敗');
            }
        } catch (error) {
            console.error('Failed to clear logs:', error);
            showError('清除日誌失敗');
        }
    }

    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showError(message) {
        elements.logsTableBody.innerHTML = `
            <tr>
                <td colspan="4">
                    <div class="empty-logs">
                        <div class="icon">❌</div>
                        <p>${escapeHtml(message)}</p>
                    </div>
                </td>
            </tr>
        `;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
