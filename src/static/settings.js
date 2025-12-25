/**
 * 系統設定頁面
 */

(function () {
  "use strict";

  const API_BASE = "";

  const elements = {
    // AI Settings
    aiProvider: document.getElementById("aiProvider"),
    apiKey: document.getElementById("apiKey"),
    toggleApiKey: document.getElementById("toggleApiKey"),
    aiModel: document.getElementById("aiModel"),
    systemPrompt: document.getElementById("systemPrompt"),
    mcpToolsPrompt: document.getElementById("mcpToolsPrompt"),
    temperature: document.getElementById("temperature"),
    maxTokens: document.getElementById("maxTokens"),
    autoReplyTimerSeconds: document.getElementById("autoReplyTimerSeconds"),
    maxToolRounds: document.getElementById("maxToolRounds"),
    debugMode: document.getElementById("debugMode"),
    testAiBtn: document.getElementById("testAiBtn"),
    saveAiBtn: document.getElementById("saveAiBtn"),
    // User Preferences
    autoSubmitOnTimeout: document.getElementById("autoSubmitOnTimeout"),
    confirmBeforeSubmit: document.getElementById("confirmBeforeSubmit"),
    defaultLanguage: document.getElementById("defaultLanguage"),
    savePreferencesBtn: document.getElementById("savePreferencesBtn"),
    toastContainer: document.getElementById("toastContainer"),
  };

  function init() {
    setupEventListeners();
    loadAISettings();
    loadPreferences();
  }

  function setupEventListeners() {
    // AI Settings
    elements.toggleApiKey.addEventListener("click", toggleApiKeyVisibility);
    elements.testAiBtn.addEventListener("click", testAIConnection);
    elements.saveAiBtn.addEventListener("click", saveAISettings);

    // User Preferences
    elements.savePreferencesBtn.addEventListener("click", savePreferences);
  }

  function toggleApiKeyVisibility() {
    const type = elements.apiKey.type;
    elements.apiKey.type = type === "password" ? "text" : "password";
    elements.toggleApiKey.textContent = type === "password" ? "🙈" : "👁️";
  }

  async function loadAISettings() {
    try {
      const response = await fetch(`${API_BASE}/api/ai-settings`);
      const data = await response.json();

      if (data.settings) {
        elements.aiProvider.value = data.settings.provider || "openai";
        elements.apiKey.value = data.settings.apiKey || "";
        elements.aiModel.value = data.settings.model || "";
        elements.systemPrompt.value = data.settings.systemPrompt || "";
        elements.mcpToolsPrompt.value = data.settings.mcpToolsPrompt || "";
        elements.temperature.value = data.settings.temperature ?? 0.7;
        elements.maxTokens.value = data.settings.maxTokens ?? 1000;
        elements.autoReplyTimerSeconds.value = data.settings.autoReplyTimerSeconds ?? 300;
        elements.maxToolRounds.value = data.settings.maxToolRounds ?? 5;
        elements.debugMode.checked = data.settings.debugMode || false;
      }
    } catch (error) {
      console.error("Failed to load AI settings:", error);
      showToast("載入 AI 設定失敗", "error");
    }
  }

  async function loadPreferences() {
    try {
      const response = await fetch(`${API_BASE}/api/preferences`);
      const data = await response.json();

      if (data.preferences) {
        elements.autoSubmitOnTimeout.checked =
          data.preferences.autoSubmitOnTimeout || false;
        elements.confirmBeforeSubmit.checked =
          data.preferences.confirmBeforeSubmit || false;
        elements.defaultLanguage.value =
          data.preferences.defaultLanguage || "zh-TW";
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
      showToast("載入用戶偏好失敗", "error");
    }
  }

  async function testAIConnection() {
    const provider = elements.aiProvider.value;
    const apiKey = elements.apiKey.value;

    if (!apiKey) {
      showToast("請先輸入 API 金鑰", "error");
      return;
    }

    elements.testAiBtn.disabled = true;
    elements.testAiBtn.textContent = "測試中...";

    try {
      const response = await fetch(`${API_BASE}/api/ai/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast("AI 連接測試成功！", "success");
      } else {
        showToast(`連接測試失敗: ${data.error || "未知錯誤"}`, "error");
      }
    } catch (error) {
      console.error("Test AI connection failed:", error);
      showToast("連接測試失敗", "error");
    } finally {
      elements.testAiBtn.disabled = false;
      elements.testAiBtn.textContent = "測試連接";
    }
  }

  async function saveAISettings() {
    const settings = {
      provider: elements.aiProvider.value,
      apiKey: elements.apiKey.value,
      model: elements.aiModel.value,
      systemPrompt: elements.systemPrompt.value,
      mcpToolsPrompt: elements.mcpToolsPrompt.value,
      temperature: parseFloat(elements.temperature.value) || 0.7,
      maxTokens: parseInt(elements.maxTokens.value) || 1000,
      autoReplyTimerSeconds: parseInt(elements.autoReplyTimerSeconds.value) || 300,
      maxToolRounds: parseInt(elements.maxToolRounds.value) || 5,
      debugMode: elements.debugMode.checked,
    };

    if (!settings.apiKey) {
      showToast("請輸入 API 金鑰", "error");
      return;
    }

    elements.saveAiBtn.disabled = true;
    elements.saveAiBtn.textContent = "儲存中...";

    try {
      const response = await fetch(`${API_BASE}/api/ai-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        showToast("AI 設定已儲存", "success");
      } else {
        const data = await response.json();
        showToast(`儲存失敗: ${data.error || "未知錯誤"}`, "error");
      }
    } catch (error) {
      console.error("Save AI settings failed:", error);
      showToast("儲存失敗", "error");
    } finally {
      elements.saveAiBtn.disabled = false;
      elements.saveAiBtn.textContent = "儲存 AI 設定";
    }
  }

  async function savePreferences() {
    const preferences = {
      autoSubmitOnTimeout: elements.autoSubmitOnTimeout.checked,
      confirmBeforeSubmit: elements.confirmBeforeSubmit.checked,
      defaultLanguage: elements.defaultLanguage.value,
    };

    elements.savePreferencesBtn.disabled = true;
    elements.savePreferencesBtn.textContent = "儲存中...";

    try {
      const response = await fetch(`${API_BASE}/api/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      if (response.ok) {
        showToast("偏好設定已儲存", "success");
      } else {
        const data = await response.json();
        showToast(`儲存失敗: ${data.error || "未知錯誤"}`, "error");
      }
    } catch (error) {
      console.error("Save preferences failed:", error);
      showToast("儲存失敗", "error");
    } finally {
      elements.savePreferencesBtn.disabled = false;
      elements.savePreferencesBtn.textContent = "儲存偏好設定";
    }
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
