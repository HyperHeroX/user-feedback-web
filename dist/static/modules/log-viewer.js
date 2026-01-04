/**
 * log-viewer.js
 * 日誌檢視器模組
 */

import {
  showToast,
  showLoadingOverlay,
  hideLoadingOverlay,
  escapeHtml,
} from "./ui-helpers.js";

// 模組內部狀態
let currentLogPage = 1;
let totalLogPages = 1;
let logSources = [];

/**
 * 開啟日誌檢視器彈窗
 */
export async function openLogViewerModal() {
  const modal = document.getElementById("logViewerModal");
  if (modal) {
    modal.classList.add("show");

    // 載入日誌來源列表
    await loadLogSources();

    // 載入第一頁日誌
    await loadLogs(1);
  }
}

/**
 * 關閉日誌檢視器彈窗
 */
export function closeLogViewerModal() {
  const modal = document.getElementById("logViewerModal");
  if (modal) {
    modal.classList.remove("show");
  }
}

/**
 * 載入日誌來源
 */
async function loadLogSources() {
  try {
    const response = await fetch("/api/logs/sources");
    if (response.ok) {
      const data = await response.json();
      logSources = data.sources || [];

      // 更新來源下拉選單
      const sourceFilter = document.getElementById("logSourceFilter");
      if (sourceFilter) {
        // 保留第一個選項
        sourceFilter.innerHTML = '<option value="">全部來源</option>';
        logSources.forEach((source) => {
          const option = document.createElement("option");
          option.value = source;
          option.textContent = source;
          sourceFilter.appendChild(option);
        });
      }
    }
  } catch (error) {
    console.error("載入日誌來源失敗:", error);
  }
}

/**
 * 載入日誌
 * @param {number} page 頁碼
 */
export async function loadLogs(page = 1) {
  const container = document.getElementById("logEntriesContainer");
  if (!container) return;

  // 顯示載入中
  container.innerHTML =
    '<div class="log-loading"><div class="spinner"></div>載入中...</div>';

  try {
    // 收集篩選參數
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", "50");

    const level = document.getElementById("logLevelFilter").value;
    if (level) params.set("level", level);

    const source = document.getElementById("logSourceFilter").value;
    if (source) params.set("source", source);

    const search = document.getElementById("logSearch").value.trim();
    if (search) params.set("search", search);

    const startDate = document.getElementById("logStartDate").value;
    if (startDate) params.set("startDate", startDate);

    const endDate = document.getElementById("logEndDate").value;
    if (endDate) params.set("endDate", endDate);

    const response = await fetch(`/api/logs?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const logs = data.logs || [];
    currentLogPage = data.pagination?.page || 1;
    totalLogPages = data.pagination?.totalPages || 1;

    // 渲染日誌條目
    if (logs.length === 0) {
      container.innerHTML = `
        <div class="placeholder">
          <span class="icon">📭</span>
          <p>沒有符合條件的日誌記錄</p>
        </div>
      `;
    } else {
      container.innerHTML = logs.map((log) => renderLogEntry(log)).join("");
    }

    // 更新分頁控制
    updateLogPagination();
  } catch (error) {
    console.error("載入日誌失敗:", error);
    container.innerHTML = `
      <div class="placeholder">
        <span class="icon">❌</span>
        <p>載入日誌失敗: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * 渲染單條日誌
 */
function renderLogEntry(log) {
  const timestamp = new Date(log.timestamp).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const levelClass = `log-level-${log.level}`;
  const searchTerm = document.getElementById("logSearch").value.trim();

  // 高亮搜尋詞
  let message = escapeHtml(log.message);
  if (searchTerm) {
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, "gi");
    message = message.replace(regex, "<mark>$1</mark>");
  }

  // 格式化 meta 資訊
  let metaHtml = "";
  if (log.meta) {
    try {
      const metaObj =
        typeof log.meta === "string" ? JSON.parse(log.meta) : log.meta;
      if (Object.keys(metaObj).length > 0) {
        metaHtml = `<div class="log-meta"><pre>${escapeHtml(
          JSON.stringify(metaObj, null, 2)
        )}</pre></div>`;
      }
    } catch (e) {
      // 如果無法解析，顯示原始字串
      if (log.meta) {
        metaHtml = `<div class="log-meta">${escapeHtml(
          String(log.meta)
        )}</div>`;
      }
    }
  }

  return `
    <div class="log-entry">
      <div class="log-entry-header">
        <span class="log-timestamp">${timestamp}</span>
        <span class="log-level ${levelClass}">${log.level}</span>
        <span class="log-source">[${escapeHtml(log.source)}]</span>
      </div>
      <div class="log-message">${message}</div>
      ${metaHtml}
    </div>
  `;
}

/**
 * 更新分頁控制
 */
function updateLogPagination() {
  const pageInfo = document.getElementById("logPageInfo");
  const prevBtn = document.getElementById("logPrevPage");
  const nextBtn = document.getElementById("logNextPage");

  if (pageInfo) {
    pageInfo.textContent = `${currentLogPage} / ${totalLogPages}`;
  }

  if (prevBtn) {
    prevBtn.disabled = currentLogPage <= 1;
  }

  if (nextBtn) {
    nextBtn.disabled = currentLogPage >= totalLogPages;
  }
}

/**
 * 搜尋日誌
 */
export function searchLogs() {
  loadLogs(1);
}

/**
 * 清除舊日誌
 */
export async function clearOldLogs() {
  // 預設清除 7 天前的日誌
  const daysToKeep = 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  if (!confirm(`確定要清除 ${daysToKeep} 天前的所有日誌嗎？此操作無法復原。`)) {
    return;
  }

  try {
    showLoadingOverlay("清除舊日誌中...");

    const response = await fetch(
      `/api/logs?endDate=${cutoffDate.toISOString().split("T")[0]}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    showToast(
      "success",
      "清除成功",
      `已刪除 ${data.deletedCount || 0} 條舊日誌`
    );

    // 重新載入日誌
    await loadLogs(1);
  } catch (error) {
    console.error("清除舊日誌失敗:", error);
    showToast("error", "清除失敗", error.message);
  } finally {
    hideLoadingOverlay();
  }
}

/**
 * 正則表達式轉義
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 處理分頁點擊
 * @param {string} direction 'prev' or 'next'
 */
export function handlePagination(direction) {
  if (direction === "prev" && currentLogPage > 1) {
    loadLogs(currentLogPage - 1);
  } else if (direction === "next" && currentLogPage < totalLogPages) {
    loadLogs(currentLogPage + 1);
  }
}

export default {
  openLogViewerModal,
  closeLogViewerModal,
  loadLogs,
  searchLogs,
  clearOldLogs,
  handlePagination,
};
