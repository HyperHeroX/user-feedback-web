/**
 * user-feedback MCP Tools - Enhanced UI
 * 前端 JavaScript 主檔案 (ES6 Modules Version)
 */

import { initSocketIO } from "./modules/socket-manager.js";

import {
  loadInitialData,
  handleUserActivity,
  updateCharCount,
  submitFeedback,
  clearImages,
  handleFileSelect,
  handleFileDrop,
  handlePaste,
  removeImage,
} from "./modules/app-core.js";

import {
  renderPrompts,
  filterPrompts,
  usePrompt,
  togglePinPrompt,
  editPrompt,
  deletePrompt,
  openPromptModal,
  closePromptModal,
  savePrompt,
} from "./modules/prompt-manager.js";

import {
  generateAIReplyWithTools,
  cancelAutoReplyConfirm,
  confirmAutoReplySubmit,
} from "./modules/feedback-handler.js";

import {
  loadMCPServers,
  openMCPServersModal,
  closeMCPServersModal,
  openMCPServerEditModal,
  closeMCPServerEditModal,
  onTransportChange,
  saveMCPServer,
  connectAllMCPServers,
  disconnectAllMCPServers,
  connectMCPServer,
  disconnectMCPServer,
  editMCPServer,
  deleteMCPServerConfirm,
} from "./modules/mcp-manager.js";

import {
  openAISettingsModal,
  closeAISettingsModal,
  saveAISettings,
  testAPIKey,
  toggleAPIKeyVisibility,
} from "./modules/settings-manager.js";

import {
  openLogViewerModal,
  closeLogViewerModal,
  loadLogs,
  searchLogs,
  clearOldLogs,
  handlePagination,
} from "./modules/log-viewer.js";

import {
  showToast,
  showAlertModal,
  hideAlertModal,
} from "./modules/ui-helpers.js";

import {
  resumeAutoReplyTimer,
  pauseAutoReplyTimer,
} from "./modules/timer-controller.js";

import { isAutoReplyTimerPaused } from "./modules/state-manager.js";

// ============ 初始化 ============

document.addEventListener("DOMContentLoaded", () => {
  console.log("Enhanced UI 初始化 (ES6 Modules)...");

  // 初始化 Socket.IO
  initSocketIO();

  // 初始化事件監聽器
  initEventListeners();

  // 載入資料
  loadInitialData();
});

// ============ 事件監聽器 ============

function initEventListeners() {
  // 文字輸入區
  const feedbackText = document.getElementById("feedbackText");
  feedbackText.addEventListener("input", handleUserActivity);
  feedbackText.addEventListener("input", updateCharCount);

  // 當使用者將焦點放在文字框時，暫停自動回覆倒數
  feedbackText.addEventListener("focus", () => {
    // 只有在計時器正在運作且尚未暫停的情況下執行
    // 注意：這裡需要檢查計時器狀態，但由於狀態分散在各模組，
    // 我們依賴 pauseAutoReplyTimer 內部的檢查邏輯
    pauseAutoReplyTimer(true);
  });

  // Ctrl+Enter 提交
  feedbackText.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      submitFeedback();
    }
  });

  // 提交按鈕
  document
    .getElementById("submitBtn")
    .addEventListener("click", submitFeedback);

  // AI 回覆按鈕 - 使用支援 MCP 工具的版本
  document
    .getElementById("aiReplyBtn")
    .addEventListener("click", generateAIReplyWithTools);

  // 圖片區域
  const imageDropZone = document.getElementById("imageDropZone");
  const fileInput = document.getElementById("fileInput");

  imageDropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", handleFileSelect);

  // 拖放事件
  imageDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    imageDropZone.classList.add("drag-over");
  });

  imageDropZone.addEventListener("dragleave", () => {
    imageDropZone.classList.remove("drag-over");
  });

  imageDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    imageDropZone.classList.remove("drag-over");
    handleFileDrop(e.dataTransfer.files);
  });

  // 貼上事件
  document.addEventListener("paste", handlePaste);

  // 清除圖片按鈕
  document
    .getElementById("clearImagesBtn")
    .addEventListener("click", clearImages);

  // 提示詞區域
  document
    .getElementById("promptSearch")
    .addEventListener("input", filterPrompts);
  document
    .getElementById("addPromptBtn")
    .addEventListener("click", () => openPromptModal());
  document
    .getElementById("addPromptBtnFooter")
    .addEventListener("click", () => openPromptModal());

  // AI 設定中的編輯提示詞按鈕
  const editPromptsFromSettings = document.getElementById(
    "editPromptsFromSettings"
  );
  if (editPromptsFromSettings) {
    editPromptsFromSettings.addEventListener("click", () => {
      openPromptModal();
    });
  }

  // AI 設定按鈕
  document
    .getElementById("aiSettingsBtn")
    .addEventListener("click", openAISettingsModal);

  // MCP Servers 按鈕
  document
    .getElementById("mcpServersBtn")
    .addEventListener("click", openMCPServersModal);
  document
    .getElementById("closeMcpServers")
    .addEventListener("click", closeMCPServersModal);
  document
    .getElementById("addMcpServer")
    .addEventListener("click", () => openMCPServerEditModal());
  document
    .getElementById("closeMcpServerEdit")
    .addEventListener("click", closeMCPServerEditModal);
  document
    .getElementById("cancelMcpServer")
    .addEventListener("click", closeMCPServerEditModal);
  document
    .getElementById("saveMcpServer")
    .addEventListener("click", saveMCPServer);
  document
    .getElementById("connectAllMcpServers")
    .addEventListener("click", connectAllMCPServers);
  document
    .getElementById("disconnectAllMcpServers")
    .addEventListener("click", disconnectAllMCPServers);
  document
    .getElementById("mcpServerTransport")
    .addEventListener("change", onTransportChange);

  // 彈窗控制
  document
    .getElementById("closeAiSettings")
    .addEventListener("click", closeAISettingsModal);
  document
    .getElementById("saveAiSettings")
    .addEventListener("click", saveAISettings);
  document.getElementById("testApiKey").addEventListener("click", testAPIKey);
  document
    .getElementById("toggleApiKey")
    .addEventListener("click", toggleAPIKeyVisibility);

  // 通用提醒彈窗確定按鈕
  const alertOkBtn = document.getElementById("alertModalOk");
  if (alertOkBtn) {
    alertOkBtn.addEventListener("click", hideAlertModal);
  }

  document
    .getElementById("closePromptModal")
    .addEventListener("click", closePromptModal);
  document
    .getElementById("cancelPrompt")
    .addEventListener("click", closePromptModal);
  document.getElementById("savePrompt").addEventListener("click", savePrompt);

  // 日誌檢視器按鈕
  document
    .getElementById("logViewerBtn")
    .addEventListener("click", openLogViewerModal);
  document
    .getElementById("closeLogViewer")
    .addEventListener("click", closeLogViewerModal);
  document.getElementById("logSearchBtn").addEventListener("click", searchLogs);
  document
    .getElementById("logRefreshBtn")
    .addEventListener("click", () => loadLogs(1));
  document
    .getElementById("logPrevPage")
    .addEventListener("click", () => handlePagination("prev"));
  document
    .getElementById("logNextPage")
    .addEventListener("click", () => handlePagination("next"));
  document
    .getElementById("clearOldLogs")
    .addEventListener("click", clearOldLogs);
  document.getElementById("logSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchLogs();
    }
  });

  // 點擊自動回覆計時區塊可切換暫停/繼續
  const setupTimerClick = (element) => {
    if (!element) return;
    element.style.cursor = "pointer";
    element.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isAutoReplyTimerPaused()) {
        resumeAutoReplyTimer();
        showToast("info", "計時器已繼續", "自動回覆倒數已恢復。");
      } else {
        pauseAutoReplyTimer(false);
        showToast(
          "info",
          "計時器已暫停",
          "已手動暫停自動回覆倒數，點擊可繼續。"
        );
      }
    });
  };

  // 設置底部計時器點擊事件
  setupTimerClick(document.getElementById("auto-reply-timer-bottom"));

  // 自動回覆確認模態框
  const closeAutoReplyConfirmBtn = document.getElementById(
    "closeAutoReplyConfirm"
  );
  if (closeAutoReplyConfirmBtn) {
    closeAutoReplyConfirmBtn.addEventListener("click", cancelAutoReplyConfirm);
  }

  const cancelAutoReplyConfirmBtn = document.getElementById(
    "cancelAutoReplyConfirm"
  );
  if (cancelAutoReplyConfirmBtn) {
    cancelAutoReplyConfirmBtn.addEventListener("click", cancelAutoReplyConfirm);
  }

  const confirmAutoReplySubmitBtn = document.getElementById(
    "confirmAutoReplySubmit"
  );
  if (confirmAutoReplySubmitBtn) {
    confirmAutoReplySubmitBtn.addEventListener("click", confirmAutoReplySubmit);
  }

  // Escape 鍵關閉自動回覆確認模態框
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const autoReplyModal = document.getElementById("autoReplyConfirmModal");
      if (autoReplyModal && autoReplyModal.style.display === "flex") {
        cancelAutoReplyConfirm();
      }
    }
  });

  // 點擊彈窗覆蓋層關閉
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.parentElement.classList.remove("show");
      }
    });
  });
}

// ============ 全局函數（供 HTML 調用） ============
// 由於 ES6 模組有自己的作用域，需要將這些函數掛載到 window 對象
// 這樣 HTML 中的 onclick 屬性才能訪問到它們

window.removeImage = removeImage;
window.usePrompt = usePrompt;
window.togglePinPrompt = togglePinPrompt;
window.editPrompt = editPrompt;
window.deletePrompt = deletePrompt;
window.openPromptModal = openPromptModal;

// MCP Servers 全局函數
window.connectMCPServer = connectMCPServer;
window.disconnectMCPServer = disconnectMCPServer;
window.editMCPServer = editMCPServer;
window.deleteMCPServerConfirm = deleteMCPServerConfirm;
