/**
 * user-feedback MCP Tools - Enhanced UI
 * 前端 JavaScript 主檔案
 */

// ============ 全局變量 ============

let socket = null;
let sessionId = null;
let workSummary = null;
let currentImages = [];
let prompts = [];
let aiSettings = null;
let preferences = null;
let autoReplyWarningTimeout = null;
let autoReplyCountdownInterval = null;
let autoReplyCountdownRemaining = 0;
let autoReplyConfirmationTimeout = null; // 用於自動回覆確認倒數
let autoReplyData = null; // 儲存待確認的自動回覆資料
let isEditingPrompt = false;
let editingPromptId = null;
let dialogTimeoutInterval = null; // 用於 MCP_DIALOG_TIMEOUT 倒數計時
let autoReplyTimerInterval = null; // 用於自動回應倒數計時（300 秒）
let autoReplyTimerRemaining = 0; // 300 秒計時器的剩餘秒數
let autoReplyTimerPaused = false; // 是否已暫停
let autoReplyPausedByFocus = false; // 是否由於 textarea focus 導致暫停
let closeCountdownInterval = null; // 用於關閉頁面倒數計時

// 對話超時時間（秒），從伺服器環境變數讀取，默認 60 秒
// 用於關閉頁面倒數計時
let DIALOG_TIMEOUT_SECONDS = 60; // 預設值 60 秒，將從伺服器讀取

// 自動回應倒數時間（秒），從 AI 設定讀取，默認 300 秒
// 當達到 0 秒時自動啟動 AI 回應
let AUTO_REPLY_TIMER_SECONDS = 300; // 預設值 300 秒（5 分鐘），將從 AI 設定讀取

// ============ 初始化 ============

document.addEventListener("DOMContentLoaded", () => {
  console.log("Enhanced UI 初始化...");

  // 初始化 Socket.IO
  initSocketIO();

  // 初始化事件監聽器
  initEventListeners();

  // 載入資料
  loadInitialData();
});

// ============ Socket.IO 管理 ============

function initSocketIO() {
  socket = io({
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
  });

  // 連接事件
  socket.on("connect", () => {
    console.log("Socket.IO 已連接");
    updateConnectionStatus(true);

    // 請求會話
    socket.emit("request_session");
  });

  socket.on("disconnect", () => {
    console.log("Socket.IO 已斷開");
    updateConnectionStatus(false);
  });

  // 會話事件
  socket.on("session_assigned", (data) => {
    console.log("會話已分配:", data);
    sessionId = data.session_id;
    workSummary = data.work_summary;

    // 顯示 AI 訊息
    displayAIMessage(workSummary);

    // 啟動自動回覆計時器
    socket.emit("session_ready", {
      sessionId: sessionId,
      workSummary: workSummary,
    });
  });

  socket.on("no_active_session", () => {
    console.log("無活跃會話");
    showToast("info", "等待中", "目前沒有活躍的反饋會話");
  });

  // 反饋提交事件
  socket.on("feedback_submitted", (data) => {
    console.log("反饋已提交:", data);
    // 隱藏任何正在顯示的提醒彈窗
    hideAlertModal();
    showToast("success", "成功", "反饋已成功提交");

    // 選擇性清除提交輸入（保留提示詞）
    clearSubmissionInputs();

    // 停止原有的關閉倒數計時器
    if (closeCountdownInterval) {
      clearInterval(closeCountdownInterval);
      closeCountdownInterval = null;
    }

    // 3 秒後關閉頁面
    const countdownEl = document.getElementById("close-cd");
    if (countdownEl) {
      let remaining = 3;
      countdownEl.style.display = "inline-flex";
      countdownEl.textContent = remaining;

      closeCountdownInterval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
          countdownEl.textContent = remaining;
        } else {
          clearInterval(closeCountdownInterval);
          closeCountdownInterval = null;
          console.log("提交成功，3秒後關閉頁面");
          window.close();
        }
      }, 1000);
    } else {
      // 如果找不到倒數元素，直接 3 秒後關閉
      setTimeout(() => {
        window.close();
      }, 3000);
    }
  });

  socket.on("feedback_error", (data) => {
    console.error("反饋錯誤:", data);
    // 隱藏提醒彈窗（若有）並顯示錯誤
    hideAlertModal();
  showToast("error", "錯誤", formatApiError(data));
  });

  // 自動回覆事件
  socket.on("auto_reply_warning", (data) => {
    console.log("自動回覆警告:", data);
    showAutoReplyWarning(data.remainingSeconds);
  });

  socket.on("auto_reply_triggered", async (data) => {
    console.log("伺服器自動回覆已觸發:", data);
    hideAutoReplyWarning();

    // 獲取釘選提示詞
    const pinnedPromptsContent = await getPinnedPromptsContent();

    // 組合回覆：釘選提示詞 + AI 生成的回覆
    let finalReply = data.reply;
    if (pinnedPromptsContent) {
      finalReply = pinnedPromptsContent + "\n\n" + data.reply;
    }

    // 將回覆內容填入文字框
    document.getElementById("feedbackText").value = finalReply;
    updateCharCount();

    // 顯示確認模態框（10 秒倒數）
    showAutoReplyConfirmModal(finalReply);
  });

  socket.on("auto_reply_error", (data) => {
    console.error("自動回覆錯誤:", data);
    hideAutoReplyWarning();
  showToast("error", "自動回覆失敗", formatApiError(data));
  });

  socket.on("auto_reply_cancelled", () => {
    console.log("自動回覆已取消");
    hideAutoReplyWarning();
  });
}

function updateConnectionStatus(connected) {
  const statusEl = document.getElementById("connectionStatus");
  const statusText = statusEl.querySelector(".status-text");

  if (connected) {
    statusEl.classList.add("connected");
    statusEl.classList.remove("disconnected");
    statusEl.style.visibility = "visible";
    statusText.textContent = "已連接";
  } else {
    statusEl.classList.remove("connected");
    statusEl.classList.add("disconnected");
    statusEl.style.visibility = "visible";
    statusText.textContent = "連接中...";
  }
}

// ============ 事件監聽器 ============

function initEventListeners() {
  // 文字輸入區
  const feedbackText = document.getElementById("feedbackText");
  feedbackText.addEventListener("input", handleUserActivity);
  feedbackText.addEventListener("input", updateCharCount);
  // 當使用者將焦點放在文字框時，暫停自動回覆倒數，直到使用者點擊 auto-reply-timer 後才繼續
  feedbackText.addEventListener("focus", () => {
    // 只有在計時器正在運作且尚未暫停的情況下執行
    if (autoReplyTimerInterval && !autoReplyTimerPaused) {
      pauseAutoReplyTimer(true);
      showToast("info", "計時器已暫停", "已因聚焦文字輸入而暫停自動回覆倒數，點擊計時器以繼續。");
    }
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

  // AI 回覆按鈕
  document
    .getElementById("aiReplyBtn")
    .addEventListener("click", generateAIReply);

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

  // 自動回覆警告
  document
    .getElementById("cancelAutoReply")
    .addEventListener("click", cancelAutoReply);

  // 點擊自動回覆計時區塊可切換暫停/繼續（若被 focus 暫停，點擊會恢復）
  const autoReplyTimerEl = document.getElementById("auto-reply-timer");
  if (autoReplyTimerEl) {
    autoReplyTimerEl.style.cursor = "pointer";
    autoReplyTimerEl.addEventListener("click", (e) => {
      // 防止其他點擊行為
      e.stopPropagation();
      if (autoReplyTimerPaused) {
        resumeAutoReplyTimer();
        showToast("info", "計時器已繼續", "自動回覆倒數已恢復。");
      } else {
        pauseAutoReplyTimer(false);
        showToast("info", "計時器已暫停", "已手動暫停自動回覆倒數，點擊可繼續。");
      }
    });
  }

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

// ============ 資料載入 ============

async function loadInitialData() {
  try {
    // 首先從伺服器讀取配置，包括 MCP_DIALOG_TIMEOUT
    await loadServerConfig();

    // 啟動關閉頁面倒數計時
    startCloseCountdown();

    // 載入提示詞
    await loadPrompts();

    // 載入 AI 設定
    await loadAISettings();

    // 載入使用者偏好
    await loadPreferences();

    // 自動載入釘選提示詞
    await autoLoadPinnedPrompts();

    // 頁面載入完成後，啟動 300 秒計時器
    // 當倒數到 0 時自動啟動 AI 回應
    startAutoReplyTimer();
  } catch (error) {
    console.error("載入初始資料失敗:", error);
    showToast("error", "載入失敗", "無法載入初始資料");
  }
}

async function loadServerConfig() {
  try {
    const response = await fetch("/api/config");
    const data = await response.json();

    if (data.dialog_timeout) {
      // 伺服器返回的是秒，直接使用
      DIALOG_TIMEOUT_SECONDS = data.dialog_timeout;
      console.log(
        `從伺服器讀取 MCP_DIALOG_TIMEOUT: ${DIALOG_TIMEOUT_SECONDS}s`
      );
    }
  } catch (error) {
    console.error("載入伺服器配置失敗，使用預設值:", error);
    // 使用預設值 60 秒
  }
}

async function loadPrompts() {
  try {
    const response = await fetch("/api/prompts");
    const data = await response.json();

    if (data.success) {
      prompts = data.prompts;
      renderPrompts();
    }
  } catch (error) {
    console.error("載入提示詞失敗:", error);
  }
}

async function loadAISettings() {
  try {
    const response = await fetch("/api/ai-settings");
    const data = await response.json();

    if (data.success) {
      aiSettings = data.settings;
      
      // 讀取自動回覆計時器秒數設定
      if (aiSettings.autoReplyTimerSeconds !== undefined) {
        AUTO_REPLY_TIMER_SECONDS = aiSettings.autoReplyTimerSeconds;
        console.log(`從 AI 設定讀取自動回覆時間: ${AUTO_REPLY_TIMER_SECONDS}s`);
      }
    }
  } catch (error) {
    console.error("載入 AI 設定失敗:", error);
  }
}

async function loadPreferences() {
  try {
    const response = await fetch("/api/preferences");
    const data = await response.json();

    if (data.success) {
      preferences = data.preferences;
    }
  } catch (error) {
    console.error("載入使用者偏好失敗:", error);
  }
}

async function autoLoadPinnedPrompts() {
  try {
    const response = await fetch("/api/prompts/pinned");
    const data = await response.json();

    if (data.success && data.prompts.length > 0) {
      const content = data.prompts.map((p) => p.content).join("\n\n");
      document.getElementById("feedbackText").value = content;
      updateCharCount();

      showToast(
        "info",
        "提示詞已載入",
        `已自動載入 ${data.prompts.length} 個釘選提示詞`
      );
    }
  } catch (error) {
    console.error("自動載入釘選提示詞失敗:", error);
  }
}

// 獲取釘選提示詞內容
async function getPinnedPromptsContent() {
  try {
    const response = await fetch("/api/prompts/pinned");
    const data = await response.json();

    if (data.success && data.prompts.length > 0) {
      return data.prompts.map((p) => p.content).join("\n\n");
    }
    return "";
  } catch (error) {
    console.error("獲取釘選提示詞失敗:", error);
    return "";
  }
}

// ============ AI 訊息顯示 ============

function displayAIMessage(message) {
  const displayEl = document.getElementById("aiMessageDisplay");

  // 使用 Marked.js 渲染 Markdown
  const htmlContent = marked.parse(message);

  displayEl.innerHTML = `<div class="ai-message-content">${htmlContent}</div>`;
}

// ============ 使用者輸入處理 ============

function handleUserActivity() {
  // 通知服務器使用者活動，重置計時器
  if (socket && sessionId) {
    socket.emit("user_activity", {
      sessionId: sessionId,
      timestamp: Date.now(),
    });
  }
}

function updateCharCount() {
  const text = document.getElementById("feedbackText").value;
  document.getElementById("charCount").textContent = `${text.length} 字元`;
}

async function generateAIReply() {
  if (!workSummary) {
    showToast("error", "錯誤", "無法取得 AI 訊息");
    return;
  }

  const userContext = document.getElementById("feedbackText").value;

  showLoadingOverlay("正在生成 AI 回覆...");

  try {
    const response = await fetch("/api/ai-reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aiMessage: workSummary,
        userContext: userContext,
      }),
    });

    const data = await response.json();

    if (data.success) {
      // 獲取釘選提示詞
      const pinnedPromptsContent = await getPinnedPromptsContent();

      // 組合回覆：釘選提示詞 + AI 生成的回覆
      let finalReply = data.reply;
      if (pinnedPromptsContent) {
        finalReply = pinnedPromptsContent + "\n\n" + data.reply;
      }

      document.getElementById("feedbackText").value = finalReply;
      updateCharCount();

      // 倒數計時器已在頁面載入時啟動，無需額外處理

      // 顯示簡單彈窗提示 AI 已完成回覆
      showAlertModal("AI 已完成回覆", "AI 已經生成回覆，請檢查後提交。");
    } else {
      showToast("error", "AI 回覆失敗", data.error);
    }
  } catch (error) {
    console.error("生成 AI 回覆失敗:", error);
    showToast("error", "錯誤", "無法生成 AI 回覆");
  } finally {
    hideLoadingOverlay();
  }
}

// ============ 反饋提交 ============

async function submitFeedback() {
  const text = document.getElementById("feedbackText").value.trim();

  if (!text && currentImages.length === 0) {
    showToast("error", "錯誤", "請提供文字回應或上傳圖片");
    return;
  }

  if (!sessionId) {
    showToast("error", "錯誤", "會話 ID 不存在");
    return;
  }

  // 使用彈窗提示而不要出現遮罩
  showAlertModal("提交中", "正在提交反饋，請稍候...");

  const feedbackData = {
    sessionId: sessionId,
    text: text,
    images: currentImages,
    timestamp: Date.now(),
    shouldCloseAfterSubmit: false,
  };

  // 停止所有計時器
  stopAllTimers();

  socket.emit("submit_feedback", feedbackData);
}

function clearInputs() {
  document.getElementById("feedbackText").value = "";
  updateCharCount();
  clearImages();
}

/**
 * 選擇性清除提交輸入 - 清空文本、圖片、字數計數，但保留提示詞狀態
 * 用於成功提交反饋後
 */
function clearSubmissionInputs() {
  // 清除反饋文本
  document.getElementById("feedbackText").value = "";
  updateCharCount();

  // 清除圖片
  clearImages();

  // 停止所有計時器
  stopAllTimers();

  // 保留: 提示詞狀態、AI 設置、偏好設置
  // 這些全局變數不會被清除
}

/**
 * 停止所有計時器
 */
function stopAllTimers() {
  // 停止對話超時計時器
  if (dialogTimeoutInterval) {
    clearInterval(dialogTimeoutInterval);
    dialogTimeoutInterval = null;
  }

  // 停止關閉頁面倒數計時器
  if (closeCountdownInterval) {
    clearInterval(closeCountdownInterval);
    closeCountdownInterval = null;
  }
  const countdownEl = document.getElementById("close-cd");
  if (countdownEl) {
    countdownEl.style.display = "none";
  }

  // 停止自動回應計時器
  if (autoReplyTimerInterval) {
    clearInterval(autoReplyTimerInterval);
    autoReplyTimerInterval = null;
  }
  const timerEl = document.getElementById("auto-reply-timer");
  if (timerEl) {
    timerEl.classList.remove("active");
  }

  // 停止自動回覆確認計時器
  if (autoReplyConfirmationTimeout) {
    clearInterval(autoReplyConfirmationTimeout);
    autoReplyConfirmationTimeout = null;
  }
}

/**
 * 開始關閉頁面倒數計時
 * 從 MCP_DIALOG_TIMEOUT 取得秒數，倒數到 0 時自動關閉頁面
 */
function startCloseCountdown() {
  const countdownEl = document.getElementById("close-cd");
  if (!countdownEl) {
    console.warn("關閉倒數計時器元素 (close-cd) 未找到");
    return;
  }

  // 停止之前的計時器（如果存在）
  if (closeCountdownInterval) {
    clearInterval(closeCountdownInterval);
  }

  let remaining = DIALOG_TIMEOUT_SECONDS;
  countdownEl.style.display = "inline-flex";
  countdownEl.textContent = remaining;

  console.log(`開始關閉頁面倒數計時: ${remaining} 秒`);

  closeCountdownInterval = setInterval(() => {
    remaining--;
    countdownEl.textContent = remaining;

    if (remaining <= 0) {
      clearInterval(closeCountdownInterval);
      closeCountdownInterval = null;
      console.log("倒數結束，關閉頁面");
      window.close();
    }
  }, 1000);
}

// ============ 圖片處理 ============

function handleFileSelect(e) {
  handleFileDrop(e.target.files);
}

function handleFileDrop(files) {
  Array.from(files).forEach((file) => {
    if (file.type.startsWith("image/")) {
      readImageFile(file);
    }
  });
}

function handlePaste(e) {
  const items = e.clipboardData.items;

  for (let item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      readImageFile(file);
    }
  }
}

function readImageFile(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    const imageData = {
      name: file.name,
      data: e.target.result.split(",")[1], // 移除 data:image/...;base64, 前綴
      size: file.size,
      type: file.type,
    };

    currentImages.push(imageData);
    addImagePreview(e.target.result, currentImages.length - 1);
    updateImageCount();
  };

  reader.readAsDataURL(file);
}

function addImagePreview(dataUrl, index) {
  const container = document.getElementById("imagePreviewContainer");
  const dropZone = document.getElementById("imageDropZone");

  // 隱藏拖放區
  if (currentImages.length > 0) {
    dropZone.style.display = "none";
    container.style.display = "flex";
  }

  const preview = document.createElement("div");
  preview.className = "image-preview";
  preview.innerHTML = `
        <img src="${dataUrl}" alt="Preview">
        <button class="image-preview-remove" onclick="removeImage(${index})">✖</button>
    `;

  container.appendChild(preview);
}

function removeImage(index) {
  currentImages.splice(index, 1);

  // 重新渲染所有圖片預覽
  const container = document.getElementById("imagePreviewContainer");
  container.innerHTML = "";

  currentImages.forEach((img, i) => {
    const dataUrl = `data:${img.type};base64,${img.data}`;
    addImagePreview(dataUrl, i);
  });

  updateImageCount();

  // 如果沒有圖片了，顯示拖放區
  if (currentImages.length === 0) {
    document.getElementById("imageDropZone").style.display = "flex";
    container.style.display = "none";
  }
}

function clearImages() {
  currentImages = [];
  document.getElementById("imagePreviewContainer").innerHTML = "";
  document.getElementById("imageDropZone").style.display = "flex";
  document.getElementById("imagePreviewContainer").style.display = "none";
  updateImageCount();
}

function updateImageCount() {
  document.getElementById("imageCount").textContent = currentImages.length;
}

// ============ 提示詞管理 ============

function renderPrompts(searchTerm = "") {
  const listEl = document.getElementById("promptList");

  let filteredPrompts = prompts;
  if (searchTerm) {
    filteredPrompts = prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category &&
          p.category.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  if (filteredPrompts.length === 0) {
    listEl.innerHTML = `
            <div class="placeholder">
                <span class="icon">📋</span>
                <p>${searchTerm ? "找不到符合的提示詞" : "尚無提示詞"}</p>
                <button id="addPromptBtn" class="btn btn-secondary btn-sm" onclick="openPromptModal()">新增提示詞</button>
            </div>
        `;
    return;
  }

  listEl.innerHTML = filteredPrompts
    .map(
      (prompt) => `
        <div class="prompt-item ${
          prompt.isPinned ? "pinned" : ""
        }" onclick="usePrompt(${prompt.id})">
            <div class="prompt-item-header">
                <div class="prompt-item-title">${escapeHtml(prompt.title)}</div>
                <div class="prompt-item-actions">
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); togglePinPrompt(${
                      prompt.id
                    })" title="${prompt.isPinned ? "取消釘選" : "釘選"}">
                        <span class="icon">${
                          prompt.isPinned ? "📍" : "📌"
                        }</span>
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); editPrompt(${
                      prompt.id
                    })" title="編輯">
                        <span class="icon">✏️</span>
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); deletePrompt(${
                      prompt.id
                    })" title="刪除">
                        <span class="icon">🗑️</span>
                    </button>
                </div>
            </div>
            <div class="prompt-item-content">${escapeHtml(prompt.content)}</div>
            ${
              prompt.category
                ? `
                <div class="prompt-item-footer">
                    <span class="prompt-item-category">${escapeHtml(
                      prompt.category
                    )}</span>
                </div>
            `
                : ""
            }
        </div>
    `
    )
    .join("");
}

function filterPrompts() {
  const searchTerm = document.getElementById("promptSearch").value;
  renderPrompts(searchTerm);
}

function usePrompt(id) {
  const prompt = prompts.find((p) => p.id === id);
  if (!prompt) return;

  const feedbackText = document.getElementById("feedbackText");
  const currentText = feedbackText.value;

  // 如果有內容，在新行添加
  if (currentText.trim()) {
    feedbackText.value = currentText + "\n\n" + prompt.content;
  } else {
    feedbackText.value = prompt.content;
  }

  updateCharCount();
  handleUserActivity();

  showToast("success", "提示詞已使用", `已插入「${prompt.title}」`);
}

async function togglePinPrompt(id) {
  try {
    const response = await fetch(`/api/prompts/${id}/pin`, {
      method: "PUT",
    });

    const data = await response.json();

    if (data.success) {
      await loadPrompts();
      showToast(
        "success",
        "成功",
        data.prompt.isPinned ? "已釘選提示詞" : "已取消釘選"
      );
    } else {
    showToast("error", "錯誤", formatApiError(data));
    }
  } catch (error) {
    console.error("切換釘選狀態失敗:", error);
    showToast("error", "錯誤", "操作失敗");
  }
}

function editPrompt(id) {
  const prompt = prompts.find((p) => p.id === id);
  if (!prompt) return;

  isEditingPrompt = true;
  editingPromptId = id;

  document.getElementById("promptModalTitle").textContent = "編輯提示詞";
  document.getElementById("promptId").value = id;
  document.getElementById("promptTitle").value = prompt.title;
  document.getElementById("promptContent").value = prompt.content;
  document.getElementById("promptCategory").value = prompt.category || "";
  document.getElementById("promptIsPinned").checked = prompt.isPinned;

  openPromptModal();
}

async function deletePrompt(id) {
  if (!confirm("確定要刪除此提示詞嗎？")) return;

  try {
    const response = await fetch(`/api/prompts/${id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (data.success) {
      await loadPrompts();
      showToast("success", "成功", "提示詞已刪除");
    } else {
  showToast("error", "錯誤", formatApiError(data));
    }
  } catch (error) {
    console.error("刪除提示詞失敗:", error);
    showToast("error", "錯誤", "刪除失敗");
  }
}

function openPromptModal() {
  if (!isEditingPrompt) {
    document.getElementById("promptModalTitle").textContent = "新增提示詞";
    document.getElementById("promptForm").reset();
    document.getElementById("promptId").value = "";
  }

  document.getElementById("promptModal").classList.add("show");
}

function closePromptModal() {
  document.getElementById("promptModal").classList.remove("show");
  isEditingPrompt = false;
  editingPromptId = null;
}

async function savePrompt() {
  const title = document.getElementById("promptTitle").value.trim();
  const content = document.getElementById("promptContent").value.trim();
  const category = document.getElementById("promptCategory").value.trim();
  const isPinned = document.getElementById("promptIsPinned").checked;

  if (!title || !content) {
    showToast("error", "錯誤", "標題和內容為必填欄位");
    return;
  }

  const promptData = {
    title,
    content,
    category: category || undefined,
    isPinned,
  };

  try {
    let response;
    if (isEditingPrompt && editingPromptId) {
      // 更新
      response = await fetch(`/api/prompts/${editingPromptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promptData),
      });
    } else {
      // 創建
      response = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promptData),
      });
    }

    const data = await response.json();

    if (data.success) {
      await loadPrompts();
      closePromptModal();
      showToast(
        "success",
        "成功",
        isEditingPrompt ? "提示詞已更新" : "提示詞已創建"
      );
    } else {
  showToast("error", "錯誤", formatApiError(data));
    }
  } catch (error) {
    console.error("保存提示詞失敗:", error);
    showToast("error", "錯誤", "保存失敗");
  }
}

// ============ AI 設定 ============

function openAISettingsModal() {
  if (aiSettings) {
    document.getElementById("apiUrl").value = aiSettings.apiUrl;
    document.getElementById("model").value = aiSettings.model;
    document.getElementById("apiKey").value = ""; // 不顯示現有 API Key
    document.getElementById("systemPrompt").value = aiSettings.systemPrompt;
    document.getElementById("temperature").value =
      aiSettings.temperature || 0.7;
    document.getElementById("maxTokens").value = aiSettings.maxTokens || 1000;
    document.getElementById("autoReplyTimerSeconds").value = 
      aiSettings.autoReplyTimerSeconds || 300;
  }

  document.getElementById("aiSettingsModal").classList.add("show");
}

function closeAISettingsModal() {
  document.getElementById("aiSettingsModal").classList.remove("show");
}

async function saveAISettings() {
  const apiUrl = document.getElementById("apiUrl").value.trim();
  const model = document.getElementById("model").value.trim();
  const apiKey = document.getElementById("apiKey").value.trim();
  const systemPrompt = document.getElementById("systemPrompt").value.trim();
  const temperature = parseFloat(document.getElementById("temperature").value);
  const maxTokens = parseInt(document.getElementById("maxTokens").value);
  const autoReplyTimerSeconds = parseInt(document.getElementById("autoReplyTimerSeconds").value);

  const settingsData = {
    apiUrl: apiUrl || undefined,
    model: model || undefined,
    apiKey: apiKey || undefined, // 如果空白則不更新
    systemPrompt: systemPrompt || undefined,
    temperature,
    maxTokens,
    autoReplyTimerSeconds,
  };

  try {
    const response = await fetch("/api/ai-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settingsData),
    });

    let data;
    try {
      data = await response.json();
    } catch (e) {
      // 不是 JSON 回應，讀取純文字
      const text = await response.text();
      console.error('非 JSON 回應:', text);
      showToast('error', '錯誤', `儲存失敗：${text}`);
      return;
    }

    if (data && data.success) {
      aiSettings = data.settings;
      
      // 更新自動回覆計時器秒數
      if (aiSettings.autoReplyTimerSeconds !== undefined) {
        AUTO_REPLY_TIMER_SECONDS = aiSettings.autoReplyTimerSeconds;
        console.log(`自動回覆時間已更新為: ${AUTO_REPLY_TIMER_SECONDS}s`);
      }
      closeAISettingsModal();
      showToast("success", "成功", "AI 設定已儲存");
    } else {
      // 儘可能顯示詳細錯誤資訊
      const detailParts = [];
      if (data.error) detailParts.push(data.error);
      if (data.details) detailParts.push(typeof data.details === 'string' ? data.details : JSON.stringify(data.details));
      if (data.stack) detailParts.push(data.stack);
      const message = detailParts.join(' \n ');
      console.error('儲存 AI 設定失敗:', data);
      showToast("error", "錯誤", message || '儲存 AI 設定失敗');
    }
  } catch (error) {
    console.error("儲存 AI 設定失敗:", error);
    // 如果有 response 物件，可嘗試讀取更多內容
    if (error && error.response) {
      try {
        const text = await error.response.text();
        showToast('error', '錯誤', `儲存失敗：${text}`);
        return;
      } catch (e) {
        // ignore
      }
    }

    showToast("error", "錯誤", error instanceof Error ? error.message : '儲存失敗');
  }
}

async function testAPIKey() {
  const apiKey = document.getElementById("apiKey").value.trim();
  const model = document.getElementById("model").value.trim();

  if (!apiKey) {
    showToast("error", "錯誤", "請輸入 API Key");
    return;
  }

  if (!model) {
    showToast("error", "錯誤", "請輸入模型名稱");
    return;
  }

  showLoadingOverlay("正在測試 API Key...");

  try {
    const response = await fetch("/api/ai-settings/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, model }),
    });

    const data = await response.json();

    if (data.valid) {
      showToast("success", "測試成功", "API Key 有效");
    } else {
      showToast("error", "測試失敗", data.error || "API Key 無效");
    }
  } catch (error) {
    console.error("測試 API Key 失敗:", error);
    showToast("error", "錯誤", "測試失敗");
  } finally {
    hideLoadingOverlay();
  }
}

function toggleAPIKeyVisibility() {
  const apiKeyInput = document.getElementById("apiKey");
  const toggleBtn = document.getElementById("toggleApiKey");

  if (apiKeyInput.type === "password") {
    apiKeyInput.type = "text";
    toggleBtn.innerHTML = '<span class="icon">🙈</span>';
  } else {
    apiKeyInput.type = "password";
    toggleBtn.innerHTML = '<span class="icon">👁️</span>';
  }
}

// ============ 自動回覆 UI ============

function showAutoReplyWarning(seconds) {
  const warningEl = document.getElementById("autoReplyWarning");
  const warningText = document.getElementById("warningText");

  warningText.textContent = `系統將在 ${seconds} 秒後自動生成回應`;
  warningEl.style.display = "block";

  // 每秒更新倒數
  let remaining = seconds;
  autoReplyWarningTimeout = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      warningText.textContent = `系統將在 ${remaining} 秒後自動生成回應`;
    } else {
      // 倒數結束時隱藏提示
      clearInterval(autoReplyWarningTimeout);
      autoReplyWarningTimeout = null;
      warningEl.style.display = "none";
    }
  }, 1000);
}

function hideAutoReplyWarning() {
  const warningEl = document.getElementById("autoReplyWarning");
  warningEl.style.display = "none";

  if (autoReplyWarningTimeout) {
    clearInterval(autoReplyWarningTimeout);
    autoReplyWarningTimeout = null;
  }
}

/**
 * [已廢棄] 原本用於 AI 回覆對話超時計時
 * 現在由 startCloseCountdown() 統一處理頁面關閉倒數
 */
function startDialogTimeout() {
  // 此函數已被 startCloseCountdown() 替代
  console.log("startDialogTimeout() 已廢棄，使用 startCloseCountdown()");
}

/**
 * 開始自動回應倒數計時（300 秒）
 * 顯示在 auto-reply-timer 容器中（中間下方）
 * 當倒數到 0 秒時自動啟動 AI 回應
 */
function startAutoReplyTimer() {
  const timerEl = document.getElementById("auto-reply-timer");
  const secondsEl = document.getElementById("auto-reply-seconds");

  if (!timerEl || !secondsEl) {
    console.warn("自動回應計時器元素未找到");
    return;
  }

  // 初始化計時器（300 秒）
  autoReplyTimerRemaining = AUTO_REPLY_TIMER_SECONDS;

  // 顯示計時器
  timerEl.classList.add("active");

  // 清空先前的計時器
  if (autoReplyTimerInterval) {
    clearInterval(autoReplyTimerInterval);
  }

  // 更新倒數文本（尊重暫停狀態）
  const updateCountdown = () => {
    if (autoReplyTimerPaused) {
      // 當暫停時，只更新樣式/顯示但不遞減
      secondsEl.textContent = autoReplyTimerRemaining;
      return;
    }

    if (autoReplyTimerRemaining > 0) {
      secondsEl.textContent = autoReplyTimerRemaining;
      autoReplyTimerRemaining--;
    } else {
      // 倒數完成，自動啟動 AI 回應
      clearInterval(autoReplyTimerInterval);
      autoReplyTimerInterval = null;
      console.log("自動回應時間已到，啟動 AI 回應");
      triggerAutoAIReply();
    }
  };

  // 立即顯示第一個倒數值
  secondsEl.textContent = autoReplyTimerRemaining;
  // 如果計時器未暫停，先遞減一次
  if (!autoReplyTimerPaused) autoReplyTimerRemaining--;

  // 每秒更新一次
  autoReplyTimerInterval = setInterval(updateCountdown, 1000);
}

/**
 * 暫停自動回覆計時器
 * @param {boolean} byFocus - 是否由焦點事件引起的暫停
 */
function pauseAutoReplyTimer(byFocus = false) {
  autoReplyTimerPaused = true;
  if (byFocus) autoReplyPausedByFocus = true;
  const timerEl = document.getElementById("auto-reply-timer");
  if (timerEl) timerEl.classList.add("paused");
}

/**
 * 恢復自動回覆計時器
 */
function resumeAutoReplyTimer() {
  // 只有在被 focus 暫停但使用者點擊過計時器時才恢復
  autoReplyTimerPaused = false;
  autoReplyPausedByFocus = false;
  const timerEl = document.getElementById("auto-reply-timer");
  if (timerEl) timerEl.classList.remove("paused");
}

/**
 * 觸發自動 AI 回應
 * 倒數到 0 秒時調用此函數
 * 流程：呼叫 AI 回覆 → 取得內容 → 彈出 10 秒確認視窗 → 10 秒後提交
 */
async function triggerAutoAIReply() {
  console.log("觸發自動 AI 回應...");

  // 隱藏計時器
  const timerEl = document.getElementById("auto-reply-timer");
  if (timerEl) {
    timerEl.classList.remove("active");
  }

  // 檢查是否有 workSummary
  if (!workSummary) {
    console.error("無法取得 AI 訊息");
    showToast("error", "錯誤", "無法取得 AI 訊息，自動回覆失敗");
    return;
  }

  // 顯示載入中
  showLoadingOverlay("正在自動生成 AI 回覆...");

  try {
    // 呼叫 AI 回覆 API
    const userContext = document.getElementById("feedbackText").value;

    const response = await fetch("/api/ai-reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aiMessage: workSummary,
        userContext: userContext,
      }),
    });

    const data = await response.json();

    if (data.success) {
      // 取得釘選提示詞
      const pinnedPromptsContent = await getPinnedPromptsContent();

      // 組合回覆：釘選提示詞 + AI 生成的回覆
      let finalReply = data.reply;
      if (pinnedPromptsContent) {
        finalReply = pinnedPromptsContent + "\n\n" + data.reply;
      }

      // 將回覆內容填入文字框
      document.getElementById("feedbackText").value = finalReply;
      updateCharCount();

      hideLoadingOverlay();

      // 彈出 10 秒確認視窗
      showAutoReplyConfirmModal(finalReply);
    } else {
      hideLoadingOverlay();
      showToast("error", "AI 回覆失敗", data.error);
    }
  } catch (error) {
    console.error("自動生成 AI 回覆失敗:", error);
    hideLoadingOverlay();
    showToast("error", "錯誤", "無法自動生成 AI 回覆");
  }
}

/**
 * 開始自動回覆倒數計時
 * 用於自動回覆觸發時，不自動提交反饋
 * 倒數完成時由 showAutoReplyConfirmModal 控制提交邏輯
 */
function startAutoReplyCountdown() {
  // 在連接狀態區塊中顯示自動回覆計時器
  const timerEl = document.getElementById("auto-reply-timer");
  const secondsEl = document.getElementById("auto-reply-seconds");

  if (!timerEl || !secondsEl) {
    console.warn("自動回覆計時器元素未找到");
    return;
  }

  // 從環境變數計算倒數秒數 (DIALOG_TIMEOUT_MS = 60000 毫秒 = 60 秒)
  const totalSeconds = Math.ceil(DIALOG_TIMEOUT_MS / 1000);
  autoReplyCountdownRemaining = totalSeconds;

  // 顯示計時器 (使用 CSS class 而非 inline style)
  timerEl.classList.add("active");

  // 清空先前的計時器
  if (autoReplyCountdownInterval) {
    clearInterval(autoReplyCountdownInterval);
  }

  // 更新倒數文本
  const updateCountdown = () => {
    if (autoReplyCountdownRemaining > 0) {
      secondsEl.textContent = autoReplyCountdownRemaining;
      autoReplyCountdownRemaining--;
    } else {
      // 倒數完成
      clearInterval(autoReplyCountdownInterval);
      timerEl.classList.remove("active");
      console.log("倒數計時完成");
    }
  };

  // 立即顯示第一個倒數值
  secondsEl.textContent = autoReplyCountdownRemaining;
  autoReplyCountdownRemaining--;

  // 每秒更新一次
  autoReplyCountdownInterval = setInterval(updateCountdown, 1000);
}

/**
 * 停止自動回覆倒數計時
 */
function stopAutoReplyCountdown() {
  if (autoReplyCountdownInterval) {
    clearInterval(autoReplyCountdownInterval);
    autoReplyCountdownInterval = null;
  }
  // 注意: close-cd 是獨立的頁面關閉倒數，不在此處理
}

function cancelAutoReply() {
  if (socket && sessionId) {
    socket.emit("cancel_auto_reply", { sessionId });
  }
  hideAutoReplyWarning();
}

/**
 * 顯示自動回覆確認模態框
 */
/**
 * 顯示自動回覆確認模態框
 * 彈出 10 秒確認視窗，超過 10 秒後自動提交
 */
function showAutoReplyConfirmModal(replyContent) {
  const modal = document.getElementById("autoReplyConfirmModal");
  const preview = document.getElementById("autoReplyPreview");
  const countdown = document.getElementById("autoReplyCountdown");

  if (!modal) {
    console.warn("自動回覆確認模態框未找到");
    return;
  }

  // 顯示預覽內容
  preview.textContent = replyContent;

  // 顯示模態框
  modal.style.display = "flex";

  // 儲存回覆內容
  autoReplyData = replyContent;

  // 10 秒倒數
  const totalSeconds = 10;
  countdown.textContent = totalSeconds;

  // 開始倒數 (用於模態框中的顯示)
  let remainingSeconds = totalSeconds;
  if (autoReplyConfirmationTimeout) {
    clearInterval(autoReplyConfirmationTimeout);
  }

  autoReplyConfirmationTimeout = setInterval(() => {
    remainingSeconds--;
    countdown.textContent = remainingSeconds;

    if (remainingSeconds <= 0) {
      clearInterval(autoReplyConfirmationTimeout);
      autoReplyConfirmationTimeout = null;
      // 10 秒到達，自動確認並提交
      console.log("10 秒倒數結束，自動提交回應");
      confirmAutoReplySubmit();
    }
  }, 1000);
}

/**
 * 隱藏自動回覆確認模態框
 */
function hideAutoReplyConfirmModal() {
  const modal = document.getElementById("autoReplyConfirmModal");
  if (modal) {
    modal.style.display = "none";
  }

  if (autoReplyConfirmationTimeout) {
    clearInterval(autoReplyConfirmationTimeout);
    autoReplyConfirmationTimeout = null;
  }
}

/**
 * 確認自動回覆提交
 */
function confirmAutoReplySubmit() {
  hideAutoReplyConfirmModal();

  if (autoReplyData) {
    // 填入回覆內容
    document.getElementById("feedbackText").value = autoReplyData;
    updateCharCount();

    // 清除資料
    autoReplyData = null;

    // 提交反饋
    console.log("確認自動回覆，提交反饋");
    submitFeedback();
  }
}

/**
 * 取消自動回覆
 */
function cancelAutoReplyConfirm() {
  hideAutoReplyConfirmModal();
  autoReplyData = null;
  console.log("已取消自動回覆");
}

// ============ UI 輔助函數 ============

function showToast(type, title, message) {
  const container = document.getElementById("toastContainer");

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

  // 3 秒後自動移除
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function getToastIcon(type) {
  switch (type) {
    case "success":
      return "✅";
    case "error":
      return "❌";
    case "info":
      return "ℹ️";
    default:
      return "📢";
  }
}

// 將 API 回傳的錯誤物件格式化為字串（包含 details 與 stack）
function formatApiError(data) {
  if (!data) return '未知錯誤';
  if (typeof data === 'string') return data;
  try {
    const parts = [];
    if (data.error) parts.push(data.error);
    if (data.details) parts.push(typeof data.details === 'string' ? data.details : JSON.stringify(data.details));
    if (data.stack) parts.push(data.stack);
    return parts.join('\n') || JSON.stringify(data);
  } catch (e) {
    return String(data);
  }
}

// 顯示通用提醒彈窗
function showAlertModal(title, message) {
  const modal = document.getElementById("alertModal");
  if (!modal) return;
  const titleEl = document.getElementById("alertModalTitle");
  const bodyEl = document.getElementById("alertModalBody");

  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.textContent = message;

  modal.classList.add("show");
}

function hideAlertModal() {
  const modal = document.getElementById("alertModal");
  if (!modal) return;
  modal.classList.remove("show");
}

function showLoadingOverlay(text = "處理中...") {
  document.getElementById("loadingText").textContent = text;
  document.getElementById("loadingOverlay").style.display = "flex";
}

function hideLoadingOverlay() {
  document.getElementById("loadingOverlay").style.display = "none";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============ 全局函數（供 HTML 調用） ============

window.removeImage = removeImage;
window.usePrompt = usePrompt;
window.togglePinPrompt = togglePinPrompt;
window.editPrompt = editPrompt;
window.deletePrompt = deletePrompt;
window.openPromptModal = openPromptModal;
