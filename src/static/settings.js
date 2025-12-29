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
    // CLI Settings
    aiModeApi: document.getElementById("aiModeApi"),
    aiModeCli: document.getElementById("aiModeCli"),
    cliTool: document.getElementById("cliTool"),
    cliToolGroup: document.getElementById("cliToolGroup"),
    cliToolStatus: document.getElementById("cliToolStatus"),
    cliTimeout: document.getElementById("cliTimeout"),
    cliTimeoutGroup: document.getElementById("cliTimeoutGroup"),
    cliFallbackToApi: document.getElementById("cliFallbackToApi"),
    cliFallbackGroup: document.getElementById("cliFallbackGroup"),
    detectCliBtn: document.getElementById("detectCliBtn"),
    saveCliBtn: document.getElementById("saveCliBtn"),
    // User Preferences
    autoSubmitOnTimeout: document.getElementById("autoSubmitOnTimeout"),
    confirmBeforeSubmit: document.getElementById("confirmBeforeSubmit"),
    defaultLanguage: document.getElementById("defaultLanguage"),
    savePreferencesBtn: document.getElementById("savePreferencesBtn"),
    toastContainer: document.getElementById("toastContainer"),
  };

  // CLI 工具檢測結果緩存
  let cliDetectionResult = null;

  function init() {
    setupEventListeners();
    loadAISettings();
    loadCLISettings();
    loadPreferences();
  }

  function setupEventListeners() {
    // AI Settings
    elements.toggleApiKey.addEventListener("click", toggleApiKeyVisibility);
    elements.testAiBtn.addEventListener("click", testAIConnection);
    elements.saveAiBtn.addEventListener("click", saveAISettings);

    // CLI Settings
    elements.aiModeApi.addEventListener("change", handleAIModeChange);
    elements.aiModeCli.addEventListener("change", handleAIModeChange);
    elements.detectCliBtn.addEventListener("click", detectCLITools);
    elements.saveCliBtn.addEventListener("click", saveCLISettings);

    // User Preferences
    elements.savePreferencesBtn.addEventListener("click", savePreferences);
  }

  function handleAIModeChange() {
    const isCLIMode = elements.aiModeCli.checked;
    elements.cliToolGroup.style.display = isCLIMode ? "block" : "none";
    elements.cliTimeoutGroup.style.display = isCLIMode ? "block" : "none";
    elements.cliFallbackGroup.style.display = isCLIMode ? "block" : "none";
    
    if (isCLIMode && !cliDetectionResult) {
      detectCLITools();
    }
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

  async function loadCLISettings() {
    try {
      const response = await fetch(`${API_BASE}/api/cli/settings`);
      const data = await response.json();

      if (data.success && data.settings) {
        const settings = data.settings;
        
        if (settings.aiMode === "cli") {
          elements.aiModeCli.checked = true;
          elements.cliToolGroup.style.display = "block";
          elements.cliTimeoutGroup.style.display = "block";
          elements.cliFallbackGroup.style.display = "block";
        } else {
          elements.aiModeApi.checked = true;
        }
        
        elements.cliTool.value = settings.cliTool || "gemini";
        elements.cliTimeout.value = Math.round((settings.cliTimeout || 120000) / 1000);
        elements.cliFallbackToApi.checked = settings.cliFallbackToApi !== false;
        
        // 如果是 CLI 模式，檢測工具
        if (settings.aiMode === "cli") {
          detectCLITools();
        }
      }
    } catch (error) {
      console.error("Failed to load CLI settings:", error);
    }
  }

  async function detectCLITools() {
    elements.cliToolStatus.textContent = "正在檢測已安裝的 CLI 工具...";
    elements.detectCliBtn.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/api/cli/detect?refresh=true`);
      const data = await response.json();

      if (data.success && data.tools) {
        cliDetectionResult = data.tools;
        
        const installedTools = data.tools.filter(t => t.installed);
        
        if (installedTools.length === 0) {
          elements.cliToolStatus.textContent = "⚠️ 未檢測到任何 CLI 工具，請先安裝 Gemini CLI 或 Claude CLI";
          elements.cliToolStatus.style.color = "var(--accent-orange)";
        } else {
          const toolNames = installedTools.map(t => `${t.name} (v${t.version})`).join(", ");
          elements.cliToolStatus.textContent = `✅ 已檢測到: ${toolNames}`;
          elements.cliToolStatus.style.color = "var(--accent-green)";
          
          // 更新下拉選單
          elements.cliTool.innerHTML = "";
          installedTools.forEach(tool => {
            const option = document.createElement("option");
            option.value = tool.name;
            option.textContent = `${tool.name === "gemini" ? "Gemini CLI" : "Claude CLI"} (v${tool.version})`;
            elements.cliTool.appendChild(option);
          });
        }
      }
    } catch (error) {
      console.error("Failed to detect CLI tools:", error);
      elements.cliToolStatus.textContent = "❌ CLI 工具檢測失敗";
      elements.cliToolStatus.style.color = "var(--accent-red)";
    } finally {
      elements.detectCliBtn.disabled = false;
    }
  }

  async function saveCLISettings() {
    const settings = {
      aiMode: elements.aiModeCli.checked ? "cli" : "api",
      cliTool: elements.cliTool.value,
      cliTimeout: parseInt(elements.cliTimeout.value) * 1000,
      cliFallbackToApi: elements.cliFallbackToApi.checked,
    };

    elements.saveCliBtn.disabled = true;
    elements.saveCliBtn.textContent = "儲存中...";

    try {
      const response = await fetch(`${API_BASE}/api/cli/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast("CLI 設定已儲存", "success");
      } else {
        showToast(`儲存失敗: ${data.error || "未知錯誤"}`, "error");
      }
    } catch (error) {
      console.error("Save CLI settings failed:", error);
      showToast("儲存失敗", "error");
    } finally {
      elements.saveCliBtn.disabled = false;
      elements.saveCliBtn.textContent = "儲存 CLI 設定";
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
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        showToast("AI 設定已儲存", "success");
      } else {
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
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        showToast("偏好設定已儲存", "success");
      } else {
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
