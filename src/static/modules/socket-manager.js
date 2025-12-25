/**
 * socket-manager.js
 * Socket.IO 連線和事件管理模組
 */

import {
  setSocket,
  setSessionId,
  setWorkSummary,
  setCurrentProjectName,
  setCurrentProjectPath,
  getSocket,
  getSessionId,
} from "./state-manager.js";

import {
  showToast,
  displayProjectInfo,
  displayAIMessage,
} from "./ui-helpers.js";

import { startCloseCountdown } from "./timer-controller.js";

// 動態導入以避免循環依賴
async function loadClearSubmissionInputs() {
  const module = await import("./feedback-handler.js");
  return module.clearSubmissionInputs;
}

/**
 * 初始化 Socket.IO 連線
 */
export function initSocketIO() {
  const socket = io();
  setSocket(socket);

  socket.on("connect", () => {
    console.log("已連線到伺服器");
    updateConnectionStatus(true);
    // 請求會話
    socket.emit("request_session");
  });

  socket.on("disconnect", () => {
    console.log("與伺服器斷線");
    updateConnectionStatus(false);
  });

  socket.on("session_assigned", (data) => {
    console.log("收到會話分配:", data);
    // 注意：伺服器使用蛇形命名 (session_id, work_summary 等)
    setSessionId(data.session_id);
    setWorkSummary(data.work_summary);
    setCurrentProjectName(data.project_name || null);
    setCurrentProjectPath(data.project_path || null);

    displayProjectInfo(data.project_name, data.project_path);
    displayAIMessage(data.work_summary);

    // 通知伺服器 session 已就緒
    socket.emit("session_ready", {
      sessionId: data.session_id,
      workSummary: data.work_summary,
    });
  });

  socket.on("feedback_submitted", async (data) => {
    console.log("反饋已提交:", data);

    if (data.success) {
      showToast("success", "提交成功", "您的回應已送出，頁面將在 3 秒後關閉");
      const clearFn = await loadClearSubmissionInputs();
      if (clearFn) clearFn();

      // 啟動 3 秒關閉倒數
      startCloseCountdown();
    } else {
      showToast("error", "提交失敗", data.error || "請稍後再試");
    }
  });

  socket.on("auto_reply", (data) => {
    console.log("收到自動回覆觸發:", data);
    if (data.autoSubmit) {
      console.log("準備自動提交...");
    }
  });

  socket.on("error", (error) => {
    console.error("Socket 錯誤:", error);
    showToast("error", "連線錯誤", error.message || "請檢查網路連線");
  });

  socket.on("close_session", () => {
    console.log("收到關閉會話訊號");
    window.close();
  });

  return socket;
}

/**
 * 更新連線狀態顯示
 * @param {boolean} connected - 是否已連線
 */
export function updateConnectionStatus(connected) {
  const containerEl = document.getElementById("connectionStatus");
  if (!containerEl) return;

  const dotEl = containerEl.querySelector(".status-dot");
  const textEl = containerEl.querySelector(".status-text");

  if (connected) {
    containerEl.classList.remove("disconnected");
    containerEl.classList.add("connected");
    if (dotEl) dotEl.classList.add("online");
    if (textEl) textEl.textContent = "已連線";
  } else {
    containerEl.classList.remove("connected");
    containerEl.classList.add("disconnected");
    if (dotEl) dotEl.classList.remove("online");
    if (textEl) textEl.textContent = "已斷線";
  }
}

/**
 * 通知伺服器使用者活動
 */
export function emitUserActivity() {
  const socket = getSocket();
  const sessionId = getSessionId();

  if (socket && sessionId) {
    socket.emit("user_activity", {
      sessionId: sessionId,
      timestamp: Date.now(),
    });
  }
}

/**
 * 發送反饋到伺服器
 * @param {Object} feedbackData - 反饋資料
 */
export function emitSubmitFeedback(feedbackData) {
  const socket = getSocket();
  if (socket) {
    socket.emit("submit_feedback", feedbackData);
  }
}

/**
 * 取消自動回覆
 */
export function emitCancelAutoReply() {
  const socket = getSocket();
  const sessionId = getSessionId();

  if (socket && sessionId) {
    socket.emit("cancel_auto_reply", { sessionId });
  }
}

export default {
  initSocketIO,
  updateConnectionStatus,
  emitUserActivity,
  emitSubmitFeedback,
  emitCancelAutoReply,
};
