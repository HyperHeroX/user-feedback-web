/**
 * app-core.js
 * 應用程式核心邏輯模組
 * 包含初始化、資料載入和核心功能聚合
 */

import {
  setDialogTimeoutSeconds,
  setAutoReplyTimerSeconds,
  setMaxToolRounds,
  setDebugMode,
} from "./state-manager.js";

import { loadPrompts, autoLoadPinnedPrompts } from "./prompt-manager.js";

import { loadAISettings, loadPreferences } from "./settings-manager.js";

import { startAutoReplyTimer } from "./timer-controller.js";

import {
  handleUserActivity as handleUserActivityImpl,
  submitFeedback as submitFeedbackImpl,
} from "./feedback-handler.js";

import {
  handleFileSelect as handleFileSelectImpl,
  handleFileDrop as handleFileDropImpl,
  handlePaste as handlePasteImpl,
  removeImage as removeImageImpl,
  clearImages as clearImagesImpl,
} from "./image-handler.js";

import { updateCharCount as updateCharCountImpl } from "./ui-helpers.js";

/**
 * 載入初始資料
 */
export async function loadInitialData() {
  try {
    // 首先從伺服器讀取配置，包括 MCP_DIALOG_TIMEOUT
    await loadServerConfig();

    // 載入並顯示版本號
    await loadVersion();

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
    // showToast("error", "載入失敗", "無法載入初始資料"); // showToast might not be available here if not imported
  }
}

/**
 * 載入伺服器配置
 */
async function loadServerConfig() {
  try {
    const response = await fetch("/api/config");
    const data = await response.json();

    if (data.dialog_timeout) {
      // 伺服器返回的是秒，直接使用
      setDialogTimeoutSeconds(data.dialog_timeout);
      console.log(`從伺服器讀取 MCP_DIALOG_TIMEOUT: ${data.dialog_timeout}s`);
    }
  } catch (error) {
    console.error("載入伺服器配置失敗，使用預設值:", error);
    // 使用預設值 60 秒 (state-manager 中已預設)
  }
}

/**
 * 載入版本資訊
 */
async function loadVersion() {
  try {
    const response = await fetch("/api/version");
    if (response.ok) {
      const data = await response.json();
      const versionDisplay = document.getElementById("version-display");
      if (versionDisplay && data.version) {
        versionDisplay.textContent = `v${data.version}`;
      }
    }
  } catch (error) {
    console.error("載入版本資訊失敗:", error);
  }
}

// 重新導出核心功能
export const handleUserActivity = handleUserActivityImpl;
export const submitFeedback = submitFeedbackImpl;
export const handleFileSelect = handleFileSelectImpl;
export const handleFileDrop = handleFileDropImpl;
export const handlePaste = handlePasteImpl;
export const removeImage = removeImageImpl;
export const clearImages = clearImagesImpl;
export const updateCharCount = updateCharCountImpl;

export default {
  loadInitialData,
  handleUserActivity,
  submitFeedback,
  handleFileSelect,
  handleFileDrop,
  handlePaste,
  removeImage,
  clearImages,
  updateCharCount,
};
