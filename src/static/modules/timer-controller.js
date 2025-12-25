/**
 * timer-controller.js
 * 計時器管理模組
 * 包含對話超時、關閉倒數、自動回覆等計時器功能
 */

import {
  getDialogTimeoutSeconds,
  getAutoReplyTimerSeconds,
  getAutoReplyTimerRemaining,
  setAutoReplyTimerRemaining,
  isAutoReplyTimerPaused,
  setAutoReplyTimerPaused,
  isAutoReplyPausedByFocus,
  setAutoReplyPausedByFocus,
  getDialogTimeoutInterval,
  setDialogTimeoutInterval,
  getCloseCountdownInterval,
  setCloseCountdownInterval,
  getAutoReplyTimerInterval,
  setAutoReplyTimerInterval,
  getAutoReplyCountdownInterval,
  setAutoReplyCountdownInterval,
  getAutoReplyWarningTimeout,
  setAutoReplyWarningTimeout,
  getAutoReplyConfirmationTimeout,
  setAutoReplyConfirmationTimeout,
} from "./state-manager.js";

// 使用動態導入打破循環依賴
let triggerAutoAIReplyFn = null;
async function loadTriggerAutoAIReply() {
  if (!triggerAutoAIReplyFn) {
    const module = await import("./feedback-handler.js");
    triggerAutoAIReplyFn = module.triggerAutoAIReply;
  }
  return triggerAutoAIReplyFn;
}

/**
 * 停止所有計時器
 */
export function stopAllTimers() {
  const dialogTimeout = getDialogTimeoutInterval();
  if (dialogTimeout) {
    clearInterval(dialogTimeout);
    setDialogTimeoutInterval(null);
  }

  const closeCountdown = getCloseCountdownInterval();
  if (closeCountdown) {
    clearInterval(closeCountdown);
    setCloseCountdownInterval(null);
  }
  const countdownEl = document.getElementById("close-cd");
  if (countdownEl) {
    countdownEl.style.display = "none";
  }

  const autoReplyTimer = getAutoReplyTimerInterval();
  if (autoReplyTimer) {
    clearInterval(autoReplyTimer);
    setAutoReplyTimerInterval(null);
  }

  // 隱藏自動回覆計時器
  const autoReplyTimerEl = document.getElementById("auto-reply-timer");
  if (autoReplyTimerEl) {
    autoReplyTimerEl.classList.remove("active", "paused");
    autoReplyTimerEl.style.display = "none";
  }

  const confirmationTimeout = getAutoReplyConfirmationTimeout();
  if (confirmationTimeout) {
    clearInterval(confirmationTimeout);
    setAutoReplyConfirmationTimeout(null);
  }
}

/**
 * 開始關閉頁面倒數計時（提交成功後 3 秒關閉）
 */
export function startCloseCountdown() {
  const countdownEl = document.getElementById("close-cd");
  if (!countdownEl) {
    console.warn("關閉倒數計時器元素 (close-cd) 未找到");
    return;
  }

  const existingInterval = getCloseCountdownInterval();
  if (existingInterval) {
    clearInterval(existingInterval);
  }

  // 固定 3 秒倒數
  let remaining = 3;
  countdownEl.style.display = "inline-flex";
  countdownEl.textContent = remaining;

  console.log(`開始關閉頁面倒數計時: ${remaining} 秒`);

  const intervalId = setInterval(() => {
    remaining--;
    countdownEl.textContent = remaining;

    if (remaining <= 0) {
      clearInterval(intervalId);
      setCloseCountdownInterval(null);
      console.log("倒數結束，關閉頁面");
      window.close();
    }
  }, 1000);

  setCloseCountdownInterval(intervalId);
}

/**
 * 取得計時器元素（使用連接狀態區塊內的計時器）
 */
function getTimerElements() {
  // 使用連接狀態區塊內的計時器
  let timerEl = document.getElementById("auto-reply-timer");
  let secondsEl = document.getElementById("auto-reply-seconds");

  return { timerEl, secondsEl };
}

/**
 * 開始自動回應倒數計時（300 秒）
 */
export function startAutoReplyTimer() {
  const { timerEl, secondsEl } = getTimerElements();

  if (!timerEl || !secondsEl) {
    console.warn("自動回應計時器元素未找到");
    return;
  }

  setAutoReplyTimerRemaining(getAutoReplyTimerSeconds());
  timerEl.style.display = "inline-flex";
  timerEl.classList.add("active");
  timerEl.classList.remove("paused");

  const existingInterval = getAutoReplyTimerInterval();
  if (existingInterval) {
    clearInterval(existingInterval);
  }

  const updateCountdown = async () => {
    const { secondsEl: currentSecondsEl } = getTimerElements();
    if (!currentSecondsEl) return;

    if (isAutoReplyTimerPaused()) {
      currentSecondsEl.textContent = getAutoReplyTimerRemaining();
      return;
    }

    const remaining = getAutoReplyTimerRemaining();
    if (remaining > 0) {
      currentSecondsEl.textContent = remaining;
      setAutoReplyTimerRemaining(remaining - 1);
    } else {
      const interval = getAutoReplyTimerInterval();
      if (interval) {
        clearInterval(interval);
        setAutoReplyTimerInterval(null);
      }
      console.log("自動回應時間已到，啟動 AI 回應");
      // 動態載入並執行
      const triggerFn = await loadTriggerAutoAIReply();
      if (triggerFn) triggerFn();
    }
  };

  secondsEl.textContent = getAutoReplyTimerRemaining();
  if (!isAutoReplyTimerPaused()) {
    setAutoReplyTimerRemaining(getAutoReplyTimerRemaining() - 1);
  }

  const intervalId = setInterval(updateCountdown, 1000);
  setAutoReplyTimerInterval(intervalId);
}

/**
 * 暫停自動回覆計時器
 * @param {boolean} byFocus - 是否由焦點事件引起的暫停
 */
export function pauseAutoReplyTimer(byFocus = false) {
  setAutoReplyTimerPaused(true);
  if (byFocus) setAutoReplyPausedByFocus(true);

  const { timerEl } = getTimerElements();
  if (timerEl) timerEl.classList.add("paused");
}

/**
 * 恢復自動回覆計時器
 */
export function resumeAutoReplyTimer() {
  setAutoReplyTimerPaused(false);
  setAutoReplyPausedByFocus(false);

  const { timerEl } = getTimerElements();
  if (timerEl) timerEl.classList.remove("paused");
}

/**
 * 停止自動回覆倒數計時
 */
export function stopAutoReplyCountdown() {
  const interval = getAutoReplyCountdownInterval();
  if (interval) {
    clearInterval(interval);
    setAutoReplyCountdownInterval(null);
  }
}

/**
 * 顯示自動回覆警告（已棄用，改用底部計時器）
 * @deprecated
 */
export function showAutoReplyWarning(seconds) {
  // 不再使用警告彈窗，計時器會常駐在底部
}

/**
 * 隱藏自動回覆警告（已棄用）
 * @deprecated
 */
export function hideAutoReplyWarning() {
  // 不再使用警告彈窗
}

export default {
  stopAllTimers,
  startCloseCountdown,
  startAutoReplyTimer,
  pauseAutoReplyTimer,
  resumeAutoReplyTimer,
  stopAutoReplyCountdown,
  showAutoReplyWarning,
  hideAutoReplyWarning,
};
