/**
 * settings-manager.js
 * AI 設定與使用者偏好管理模組
 */

import {
  getAISettings,
  setAISettings,
  setPreferences,
  setAutoReplyTimerSeconds,
  setMaxToolRounds,
  setDebugMode,
} from "./state-manager.js";

import {
  showToast,
  showLoadingOverlay,
  hideLoadingOverlay,
} from "./ui-helpers.js";

/**
 * 載入 AI 設定
 */
export async function loadAISettings() {
  try {
    const response = await fetch("/api/ai-settings");
    const data = await response.json();

    if (data.success) {
      setAISettings(data.settings);

      // 讀取自動回覆計時器秒數設定
      if (data.settings.autoReplyTimerSeconds !== undefined) {
        setAutoReplyTimerSeconds(data.settings.autoReplyTimerSeconds);
        console.log(
          `從 AI 設定讀取自動回覆時間: ${data.settings.autoReplyTimerSeconds}s`
        );
      }

      // 讀取 AI 交談次數上限
      if (data.settings.maxToolRounds !== undefined) {
        setMaxToolRounds(data.settings.maxToolRounds);
        console.log(
          `從 AI 設定讀取 AI 交談次數: ${data.settings.maxToolRounds}`
        );
      }

      // 讀取 Debug 模式
      if (data.settings.debugMode !== undefined) {
        setDebugMode(data.settings.debugMode);
        console.log(`從 AI 設定讀取 Debug 模式: ${data.settings.debugMode}`);
      }
    }
  } catch (error) {
    console.error("載入 AI 設定失敗:", error);
  }
}

/**
 * 載入使用者偏好
 */
export async function loadPreferences() {
  try {
    const response = await fetch("/api/preferences");
    const data = await response.json();

    if (data.success) {
      setPreferences(data.preferences);
    }
  } catch (error) {
    console.error("載入使用者偏好失敗:", error);
  }
}

/**
 * 開啟 AI 設定彈窗
 */
export function openAISettingsModal() {
  const aiSettings = getAISettings();
  if (aiSettings) {
    document.getElementById("apiUrl").value = aiSettings.apiUrl || "";
    document.getElementById("model").value = aiSettings.model || "";
    // API Key 欄位預設為空，不從資料庫讀取
    document.getElementById("apiKey").value = "";
    document.getElementById("apiKey").placeholder = "留空則保留原有 API Key";
    document.getElementById("systemPrompt").value =
      aiSettings.systemPrompt || "";
    document.getElementById("mcpToolsPrompt").value =
      aiSettings.mcpToolsPrompt || "";
    document.getElementById("temperature").value =
      aiSettings.temperature || 0.7;
    document.getElementById("maxTokens").value = aiSettings.maxTokens || 1000;
    document.getElementById("autoReplyTimerSeconds").value =
      aiSettings.autoReplyTimerSeconds || 300;
    document.getElementById("maxToolRounds").value =
      aiSettings.maxToolRounds || 5;
    document.getElementById("debugMode").checked =
      aiSettings.debugMode || false;
  }

  document.getElementById("aiSettingsModal").classList.add("show");
}

/**
 * 關閉 AI 設定彈窗
 */
export function closeAISettingsModal() {
  document.getElementById("aiSettingsModal").classList.remove("show");
}

/**
 * 儲存 AI 設定
 */
export async function saveAISettings() {
  const apiUrl = document.getElementById("apiUrl").value.trim();
  const model = document.getElementById("model").value.trim();
  const apiKey = document.getElementById("apiKey").value.trim();
  const systemPrompt = document.getElementById("systemPrompt").value.trim();
  const mcpToolsPrompt = document.getElementById("mcpToolsPrompt").value.trim();
  const temperature = parseFloat(document.getElementById("temperature").value);
  const maxTokens = parseInt(document.getElementById("maxTokens").value);
  const autoReplyTimerSeconds = parseInt(
    document.getElementById("autoReplyTimerSeconds").value
  );
  const maxToolRoundsValue = parseInt(
    document.getElementById("maxToolRounds").value
  );
  const debugModeValue = document.getElementById("debugMode").checked;

  const settingsData = {
    apiUrl: apiUrl || undefined,
    model: model || undefined,
    systemPrompt: systemPrompt || undefined,
    mcpToolsPrompt: mcpToolsPrompt || undefined,
    temperature,
    maxTokens,
    autoReplyTimerSeconds,
    maxToolRounds: maxToolRoundsValue,
    debugMode: debugModeValue,
  };

  // 只有當 API Key 不是遮罩格式且不為空時才更新
  if (apiKey && !apiKey.startsWith("***")) {
    settingsData.apiKey = apiKey;
  }

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
      console.error("非 JSON 回應:", text);
      showToast("error", "錯誤", `儲存失敗：${text}`);
      return;
    }

    if (data && data.success) {
      setAISettings(data.settings);

      // 更新自動回覆計時器秒數
      if (data.settings.autoReplyTimerSeconds !== undefined) {
        setAutoReplyTimerSeconds(data.settings.autoReplyTimerSeconds);
        console.log(
          `自動回覆時間已更新為: ${data.settings.autoReplyTimerSeconds}s`
        );
      }

      // 更新 AI 交談次數上限
      if (data.settings.maxToolRounds !== undefined) {
        setMaxToolRounds(data.settings.maxToolRounds);
        console.log(`AI 交談次數已更新為: ${data.settings.maxToolRounds}`);
      }

      // 更新 Debug 模式
      if (data.settings.debugMode !== undefined) {
        setDebugMode(data.settings.debugMode);
        console.log(`Debug 模式已更新為: ${data.settings.debugMode}`);
      }

      closeAISettingsModal();
      showToast("success", "成功", "AI 設定已儲存");
    } else {
      // 儘可能顯示詳細錯誤資訊
      const detailParts = [];
      if (data.error) detailParts.push(data.error);
      if (data.details)
        detailParts.push(
          typeof data.details === "string"
            ? data.details
            : JSON.stringify(data.details)
        );
      if (data.stack) detailParts.push(data.stack);
      const message = detailParts.join(" \n ");
      console.error("儲存 AI 設定失敗:", data);
      showToast("error", "錯誤", message || "儲存 AI 設定失敗");
    }
  } catch (error) {
    console.error("儲存 AI 設定失敗:", error);
    // 如果有 response 物件，可嘗試讀取更多內容
    if (error && error.response) {
      try {
        const text = await error.response.text();
        showToast("error", "錯誤", `儲存失敗：${text}`);
        return;
      } catch (e) {
        // ignore
      }
    }

    showToast(
      "error",
      "錯誤",
      error instanceof Error ? error.message : "儲存失敗"
    );
  }
}

/**
 * 測試 API Key
 */
export async function testAPIKey() {
  const apiKeyInput = document.getElementById("apiKey").value.trim();
  const model = document.getElementById("model").value.trim();

  if (!model) {
    showToast("error", "錯誤", "請輸入模型名稱");
    return;
  }

  showLoadingOverlay("正在測試 API Key...");

  try {
    const requestBody = { model };

    // 判斷是否使用新輸入的 API Key：
    // 1. API Key 不為空
    // 2. API Key 不是遮罩格式（不以 *** 開頭）
    // 如果是遮罩格式或為空，後端會自動使用資料庫中解密的 API Key
    if (apiKeyInput && !apiKeyInput.startsWith("***")) {
      requestBody.apiKey = apiKeyInput;
      console.log("使用新輸入的 API Key 進行測試");
    } else {
      console.log("使用資料庫中儲存的 API Key 進行測試");
    }

    const response = await fetch("/api/ai-settings/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
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

/**
 * 切換 API Key 可見性
 */
export function toggleAPIKeyVisibility() {
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

export default {
  loadAISettings,
  loadPreferences,
  openAISettingsModal,
  closeAISettingsModal,
  saveAISettings,
  testAPIKey,
  toggleAPIKeyVisibility,
};
