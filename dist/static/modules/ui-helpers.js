/**
 * ui-helpers.js
 * UI 輔助函數模組
 * 包含 Toast、Modal、Loading、HTML 轉義等工具函數
 */

/**
 * HTML 轉義
 * @param {string} text - 要轉義的文字
 * @returns {string} - 轉義後的文字
 */
export function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 正則表達式轉義
 * @param {string} str - 要轉義的字串
 * @returns {string} - 轉義後的字串
 */
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 顯示 Toast 通知
 * @param {string} type - 類型: success, error, info
 * @param {string} title - 標題
 * @param {string} message - 訊息
 */
export function showToast(type, title, message) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${getToastIcon(type)}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * 取得 Toast 圖標
 * @param {string} type - 類型
 * @returns {string} - 圖標
 */
function getToastIcon(type) {
  const icons = {
    success: "✅",
    error: "❌",
    info: "ℹ️",
  };
  return icons[type] || "📢";
}

/**
 * 格式化 API 錯誤為字串
 * @param {Object|string} data - 錯誤資料
 * @returns {string} - 格式化後的錯誤訊息
 */
export function formatApiError(data) {
  if (!data) return "未知錯誤";
  if (typeof data === "string") return data;

  try {
    const parts = [];
    if (data.error) parts.push(data.error);
    if (data.details) {
      parts.push(
        typeof data.details === "string"
          ? data.details
          : JSON.stringify(data.details)
      );
    }
    if (data.stack) parts.push(data.stack);
    return parts.join("\n") || JSON.stringify(data);
  } catch (e) {
    return String(data);
  }
}

/**
 * 顯示提醒彈窗
 * @param {string} title - 標題
 * @param {string} message - 訊息
 * @param {Function} onConfirm - 確認回調
 * @param {Function} onCancel - 取消回調
 */
export function showAlertModal(
  title,
  message,
  onConfirm = null,
  onCancel = null
) {
  const modal = document.getElementById("alertModal");
  if (!modal) return;

  const titleEl = document.getElementById("alertModalTitle");
  const bodyEl = document.getElementById("alertModalBody");
  const confirmBtn = document.getElementById("alertModalConfirm");
  const cancelBtn = document.getElementById("alertModalCancel");

  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.textContent = message;

  // 設置確認按鈕
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      hideAlertModal();
      if (onConfirm) onConfirm();
    };
  }

  // 設置取消按鈕
  if (cancelBtn) {
    if (onCancel) {
      cancelBtn.style.display = "block";
      cancelBtn.onclick = () => {
        hideAlertModal();
        onCancel();
      };
    } else {
      cancelBtn.style.display = "none";
    }
  }

  modal.classList.add("show");
}

/**
 * 隱藏提醒彈窗
 */
export function hideAlertModal() {
  const modal = document.getElementById("alertModal");
  if (modal) {
    modal.classList.remove("show");
  }
}

/**
 * 顯示載入遮罩
 * @param {string} text - 載入文字
 */
export function showLoadingOverlay(text = "處理中...") {
  const overlay = document.getElementById("loadingOverlay");
  const loadingText = document.getElementById("loadingText");

  if (loadingText) loadingText.textContent = text;
  if (overlay) overlay.style.display = "flex";
}

/**
 * 隱藏載入遮罩
 */
export function hideLoadingOverlay() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "none";
}

/**
 * 顯示專案資訊
 * @param {string} projectName - 專案名稱
 * @param {string} projectPath - 專案路徑
 */
export function displayProjectInfo(projectName, projectPath) {
  const projectInfoEl = document.getElementById("projectInfo");
  if (!projectInfoEl) return;

  if (projectName || projectPath) {
    const name = projectName || "未命名專案";
    const path = projectPath ? ` (${projectPath})` : "";
    projectInfoEl.innerHTML = `<span class="icon">📁</span> ${name}${path}`;
    projectInfoEl.title = projectPath || projectName || "";
  } else {
    projectInfoEl.innerHTML = "";
  }
}

/**
 * 顯示 AI 訊息
 * @param {string} message - 訊息內容 (Markdown)
 */
export function displayAIMessage(message) {
  const displayEl = document.getElementById("aiMessageDisplay");
  if (!displayEl) return;

  const htmlContent = marked.parse(message);
  displayEl.innerHTML = `<div class="ai-message-content">${htmlContent}</div>`;
}

/**
 * 更新字元計數
 */
export function updateCharCount() {
  const textEl = document.getElementById("feedbackText");
  const countEl = document.getElementById("charCount");

  if (textEl && countEl) {
    countEl.textContent = `${textEl.value.length} 字元`;
  }
}

/**
 * 截斷過長的文字
 * @param {string|Object} text - 要截斷的文字
 * @param {number} maxLength - 最大長度
 * @returns {string} - 截斷後的文字
 */
export function truncateResult(text, maxLength = 500) {
  if (typeof text !== "string") {
    text = JSON.stringify(text, null, 2);
  }
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + "\n... (已截斷)";
  }
  return text;
}

export default {
  escapeHtml,
  escapeRegex,
  showToast,
  formatApiError,
  showAlertModal,
  hideAlertModal,
  showLoadingOverlay,
  hideLoadingOverlay,
  displayProjectInfo,
  displayAIMessage,
  updateCharCount,
  truncateResult,
};
