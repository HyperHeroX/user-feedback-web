/**
 * 系統日誌頁面
 */

(function () {
  "use strict";

  const API_BASE = "";
  const PAGE_SIZE = 50;

  let currentPage = 1;
  let currentFilters = {
    level: "",
    source: "",
  };
  let totalLogs = 0;

  const elements = {
    logsTableBody: document.getElementById("logsTableBody"),
    levelFilter: document.getElementById("levelFilter"),
    sourceFilter: document.getElementById("sourceFilter"),
    refreshBtn: document.getElementById("refreshBtn"),
    clearBtn: document.getElementById("clearBtn"),
    prevPageBtn: document.getElementById("prevPageBtn"),
    nextPageBtn: document.getElementById("nextPageBtn"),
    pageInfo: document.getElementById("pageInfo"),
  };

  function init() {
    setupEventListeners();
    loadSources();
    loadLogs();
  }

  function setupEventListeners() {
    elements.levelFilter.addEventListener("change", () => {
      currentFilters.level = elements.levelFilter.value;
      currentPage = 1;
      loadLogs();
    });

    elements.sourceFilter.addEventListener("change", () => {
      currentFilters.source = elements.sourceFilter.value;
      currentPage = 1;
      loadLogs();
    });

    elements.refreshBtn.addEventListener("click", () => {
      loadLogs();
    });

    elements.clearBtn.addEventListener("click", () => {
      if (confirm("確定要清除所有日誌嗎？此操作無法復原。")) {
        clearLogs();
      }
    });

    elements.prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        loadLogs();
      }
    });

    elements.nextPageBtn.addEventListener("click", () => {
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
        elements.sourceFilter.innerHTML =
          '<option value="">全部</option>' +
          data.sources
            .map(
              (s) =>
                `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`
            )
            .join("");
      }
    } catch (error) {
      console.error("Failed to load sources:", error);
    }
  }

  async function loadLogs() {
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: PAGE_SIZE,
      });

      if (currentFilters.level) {
        params.append("level", currentFilters.level);
      }
      if (currentFilters.source) {
        params.append("source", currentFilters.source);
      }

      const response = await fetch(`${API_BASE}/api/logs?${params}`);
      const data = await response.json();

      totalLogs = data.pagination?.total || 0;
      renderLogs(data.logs || []);
      updatePagination();
    } catch (error) {
      console.error("Failed to load logs:", error);
      showError("載入日誌失敗");
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

    elements.logsTableBody.innerHTML = logs
      .map(
        (log) => `
            <tr>
                <td class="log-timestamp">${formatTimestamp(log.timestamp)}</td>
                <td><span class="log-level ${log.level}">${
          log.level
        }</span></td>
                <td class="log-source">${escapeHtml(log.source || "-")}</td>
                <td class="log-message" title="${escapeHtml(
                  log.message
                )}">${escapeHtml(log.message)}</td>
            </tr>
        `
      )
      .join("");
  }

  function updatePagination() {
    const totalPages = Math.ceil(totalLogs / PAGE_SIZE);

    elements.prevPageBtn.disabled = currentPage <= 1;
    elements.nextPageBtn.disabled =
      currentPage >= totalPages || totalPages === 0;
    elements.pageInfo.textContent = `第 ${currentPage} 頁 / 共 ${totalPages} 頁 (總計 ${totalLogs} 條)`;
  }

  async function clearLogs() {
    try {
      const response = await fetch(`${API_BASE}/api/logs`, {
        method: "DELETE",
      });

      if (response.ok) {
        currentPage = 1;
        loadLogs();
      } else {
        showError("清除日誌失敗");
      }
    } catch (error) {
      console.error("Failed to clear logs:", error);
      showError("清除日誌失敗");
    }
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
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

  // ==================== API 日誌功能 ====================

  let apiCurrentPage = 1;
  let apiTotalLogs = 0;
  let apiCurrentEndpointFilter = "";
  let apiCurrentTypeFilter = "all"; // 'all', 'success', 'errors'

  const apiElements = {
    tableBody: document.getElementById("apiErrorsTableBody"),
    endpointFilter: document.getElementById("apiEndpointFilter"),
    typeFilter: document.getElementById("apiTypeFilter"),
    refreshBtn: document.getElementById("apiRefreshBtn"),
    cleanupBtn: document.getElementById("apiCleanupBtn"),
    clearAllBtn: document.getElementById("apiClearAllBtn"),
    prevPageBtn: document.getElementById("apiPrevPageBtn"),
    nextPageBtn: document.getElementById("apiNextPageBtn"),
    pageInfo: document.getElementById("apiPageInfo"),
  };

  function setupTabSwitching() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        tabBtns.forEach(b => {
          b.classList.remove("active");
          b.style.borderBottomColor = "transparent";
          b.style.color = "var(--text-secondary)";
        });
        btn.classList.add("active");
        btn.style.borderBottomColor = "var(--accent-color)";
        btn.style.color = "var(--accent-color)";

        const tab = btn.dataset.tab;
        document.getElementById("systemLogsPanel").style.display = tab === "system" ? "block" : "none";
        document.getElementById("apiErrorsPanel").style.display = tab === "api-errors" ? "block" : "none";

        if (tab === "api-errors") {
          loadApiLogs();
        }
      });
    });
  }

  function setupApiEventListeners() {
    if (apiElements.endpointFilter) {
      apiElements.endpointFilter.addEventListener("change", () => {
        apiCurrentEndpointFilter = apiElements.endpointFilter.value;
        apiCurrentPage = 1;
        loadApiLogs();
      });
    }

    if (apiElements.typeFilter) {
      apiElements.typeFilter.addEventListener("change", () => {
        apiCurrentTypeFilter = apiElements.typeFilter.value;
        apiCurrentPage = 1;
        loadApiLogs();
      });
    }

    if (apiElements.refreshBtn) {
      apiElements.refreshBtn.addEventListener("click", () => {
        loadApiLogs();
      });
    }

    if (apiElements.cleanupBtn) {
      apiElements.cleanupBtn.addEventListener("click", async () => {
        if (confirm("確定要清除超過7天的舊日誌嗎？")) {
          try {
            const response = await fetch(`${API_BASE}/api/api-logs/cleanup?days=7`, {
              method: "DELETE",
            });
            const data = await response.json();
            if (data.success) {
              alert(`已清除 ${data.deleted} 筆舊日誌`);
              loadApiLogs();
            } else {
              alert("清除失敗: " + (data.error || "未知錯誤"));
            }
          } catch (error) {
            alert("清除失敗: " + error.message);
          }
        }
      });
    }

    if (apiElements.clearAllBtn) {
      apiElements.clearAllBtn.addEventListener("click", async () => {
        if (confirm("確定要清除所有 API 日誌嗎？此操作無法復原。")) {
          try {
            const response = await fetch(`${API_BASE}/api/api-logs/clear`, {
              method: "DELETE",
            });
            const data = await response.json();
            if (data.success) {
              alert(`已清除 ${data.deleted} 筆日誌`);
              loadApiLogs();
            } else {
              alert("清除失敗: " + (data.error || "未知錯誤"));
            }
          } catch (error) {
            alert("清除失敗: " + error.message);
          }
        }
      });
    }

    if (apiElements.prevPageBtn) {
      apiElements.prevPageBtn.addEventListener("click", () => {
        if (apiCurrentPage > 1) {
          apiCurrentPage--;
          loadApiLogs();
        }
      });
    }

    if (apiElements.nextPageBtn) {
      apiElements.nextPageBtn.addEventListener("click", () => {
        const totalPages = Math.ceil(apiTotalLogs / PAGE_SIZE);
        if (apiCurrentPage < totalPages) {
          apiCurrentPage++;
          loadApiLogs();
        }
      });
    }
  }

  async function loadApiLogs() {
    if (!apiElements.tableBody) return;

    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE,
        offset: (apiCurrentPage - 1) * PAGE_SIZE,
        filter: apiCurrentTypeFilter,
      });
      if (apiCurrentEndpointFilter) {
        params.append("endpoint", apiCurrentEndpointFilter);
      }

      const response = await fetch(`${API_BASE}/api/api-logs?${params}`);
      const data = await response.json();

      if (!data.success) {
        showApiError(data.error || "載入失敗");
        return;
      }

      apiTotalLogs = data.total;
      renderApiLogs(data.logs);
      updateApiPagination();
    } catch (error) {
      showApiError("載入日誌失敗: " + error.message);
    }
  }

  function renderApiLogs(logs) {
    if (!logs || logs.length === 0) {
      apiElements.tableBody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-logs">
              <div class="icon">📭</div>
              <p>沒有日誌記錄</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    apiElements.tableBody.innerHTML = logs
      .map(
        (log) => `
        <tr>
          <td class="log-time">${formatTimestamp(log.createdAt)}</td>
          <td><code>${escapeHtml(log.endpoint)}</code></td>
          <td><span class="log-level ${log.method.toLowerCase()}">${escapeHtml(log.method)}</span></td>
          <td><span class="log-level ${log.success ? 'info' : 'error'}">${log.success ? '✓ 成功' : '✗ 失敗'}</span></td>
          <td class="log-message" title="${escapeHtml(log.errorDetails || log.message || '')}">${escapeHtml(log.message || '-')}</td>
        </tr>
      `
      )
      .join("");
  }

  function updateApiPagination() {
    const totalPages = Math.ceil(apiTotalLogs / PAGE_SIZE) || 1;
    if (apiElements.pageInfo) {
      apiElements.pageInfo.textContent = `第 ${apiCurrentPage} / ${totalPages} 頁 (共 ${apiTotalLogs} 筆)`;
    }
    if (apiElements.prevPageBtn) {
      apiElements.prevPageBtn.disabled = apiCurrentPage <= 1;
    }
    if (apiElements.nextPageBtn) {
      apiElements.nextPageBtn.disabled = apiCurrentPage >= totalPages;
    }
  }

  function showApiError(message) {
    if (!apiElements.tableBody) return;
    apiElements.tableBody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-logs">
            <div class="icon">❌</div>
            <p>${escapeHtml(message)}</p>
          </div>
        </td>
      </tr>
    `;
  }

  // 初始化時也設定標籤切換和 API 日誌事件
  function initApiLogs() {
    setupTabSwitching();
    setupApiEventListeners();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init();
      initApiLogs();
    });
  } else {
    init();
    initApiLogs();
  }
})();

