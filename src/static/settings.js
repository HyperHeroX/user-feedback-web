/**
 * 系統設定頁面
 */

(function () {
  "use strict";

  const API_BASE = "";

  // Provider 與 API URL 的對應表 (key 需與 HTML select option value 一致)
  const PROVIDER_API_MAP = {
    openai: "https://api.openai.com/v1",
    google: "https://generativelanguage.googleapis.com/v1beta",
    anthropic: "https://api.anthropic.com/v1",
    local: "http://localhost:11434/v1"
  };

  // 反向查詢：從 API URL 取得 Provider
  function getProviderFromApiUrl(apiUrl) {
    if (!apiUrl) return "openai";
    const normalizedUrl = apiUrl.toLowerCase();
    if (normalizedUrl.includes("generativelanguage.googleapis.com")) return "google";
    if (normalizedUrl.includes("api.anthropic.com")) return "anthropic";
    if (normalizedUrl.includes("localhost") || normalizedUrl.includes("127.0.0.1")) return "local";
    if (normalizedUrl.includes("api.openai.com")) return "openai";
    return "openai"; // 預設
  }

  // 從 Provider 取得 API URL
  function getApiUrlFromProvider(provider) {
    return PROVIDER_API_MAP[provider] || PROVIDER_API_MAP.openai;
  }

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
  // 追蹤原始的 apiKeyMasked，用於判斷用戶是否修改了 API key
  let originalApiKeyMasked = "";

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
        // 從 apiUrl 反向推斷 provider
        const provider = getProviderFromApiUrl(data.settings.apiUrl);
        elements.aiProvider.value = provider;
        // API 返回的是 apiKeyMasked（遮罩後的 key），顯示給用戶看
        originalApiKeyMasked = data.settings.apiKeyMasked || "";
        elements.apiKey.value = originalApiKeyMasked;
        elements.apiKey.placeholder = originalApiKeyMasked ? "輸入新的 API Key 以更換" : "請輸入 API Key";
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
    const apiKey = elements.apiKey.value;
    const model = elements.aiModel.value;

    // 如果 API key 是遮罩值，表示用戶沒有修改，將使用資料庫中的 key
    const apiKeyChanged = apiKey !== originalApiKeyMasked;

    if (!apiKeyChanged && !originalApiKeyMasked) {
      showToast("請先輸入 API 金鑰", "error");
      return;
    }

    if (!model) {
      showToast("請先選擇模型", "error");
      return;
    }

    elements.testAiBtn.disabled = true;
    elements.testAiBtn.textContent = "測試中...";

    try {
      // 如果用戶修改了 API key 就傳送新的 key，否則不傳送（後端會使用資料庫中的）
      const payload = { model };
      if (apiKeyChanged) {
        payload.apiKey = apiKey;
      }

      const response = await fetch(`${API_BASE}/api/ai-settings/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success && data.valid) {
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
    const provider = elements.aiProvider.value;
    const currentApiKey = elements.apiKey.value;
    
    // 只有當用戶真的修改了 API key 才傳送（不是遮罩值）
    const apiKeyChanged = currentApiKey !== originalApiKeyMasked;
    
    const settings = {
      apiUrl: getApiUrlFromProvider(provider),
      model: elements.aiModel.value,
      systemPrompt: elements.systemPrompt.value,
      mcpToolsPrompt: elements.mcpToolsPrompt.value,
      temperature: parseFloat(elements.temperature.value) || 0.7,
      maxTokens: parseInt(elements.maxTokens.value) || 1000,
      autoReplyTimerSeconds: parseInt(elements.autoReplyTimerSeconds.value) || 300,
      maxToolRounds: parseInt(elements.maxToolRounds.value) || 5,
      debugMode: elements.debugMode.checked,
    };

    // 只有修改了 API key 才加入
    if (apiKeyChanged) {
      if (!currentApiKey) {
        showToast("請輸入 API 金鑰", "error");
        return;
      }
      settings.apiKey = currentApiKey;
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

