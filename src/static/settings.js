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
    // Self-Probe Settings
    enableSelfProbe: document.getElementById("enableSelfProbe"),
    selfProbeInterval: document.getElementById("selfProbeInterval"),
    selfProbeIntervalGroup: document.getElementById("selfProbeIntervalGroup"),
    selfProbeStatus: document.getElementById("selfProbeStatus"),
    selfProbeRunning: document.getElementById("selfProbeRunning"),
    selfProbeCount: document.getElementById("selfProbeCount"),
    selfProbeLastTime: document.getElementById("selfProbeLastTime"),
    saveSelfProbeBtn: document.getElementById("saveSelfProbeBtn"),
    // Prompt Config Settings
    promptConfigList: document.getElementById("promptConfigList"),
    resetPromptsBtn: document.getElementById("resetPromptsBtn"),
    savePromptsBtn: document.getElementById("savePromptsBtn"),
    // Extended Provider Settings (integrated into AI settings)
    nvidiaExtSettings: document.getElementById("nvidiaExtSettings"),
    zaiExtSettings: document.getElementById("zaiExtSettings"),
    zaiRegion: document.getElementById("zaiRegion"),
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
    loadSelfProbeSettings();
    loadPromptConfigs();
  }

  function setupEventListeners() {
    // AI Settings
    elements.toggleApiKey.addEventListener("click", toggleApiKeyVisibility);
    elements.testAiBtn.addEventListener("click", testAIConnection);
    elements.saveAiBtn.addEventListener("click", saveAISettings);
    if (elements.aiProvider) {
      elements.aiProvider.addEventListener("change", handleAIProviderChange);
    }

    // CLI Settings
    elements.aiModeApi.addEventListener("change", handleAIModeChange);
    elements.aiModeCli.addEventListener("change", handleAIModeChange);
    elements.detectCliBtn.addEventListener("click", detectCLITools);
    elements.saveCliBtn.addEventListener("click", saveCLISettings);

    // User Preferences
    elements.savePreferencesBtn.addEventListener("click", savePreferences);

    // Self-Probe Settings
    if (elements.enableSelfProbe) {
      elements.enableSelfProbe.addEventListener("change", handleSelfProbeToggle);
    }
    if (elements.saveSelfProbeBtn) {
      elements.saveSelfProbeBtn.addEventListener("click", saveSelfProbeSettings);
    }

    // Prompt Config Settings
    if (elements.resetPromptsBtn) {
      elements.resetPromptsBtn.addEventListener("click", resetPromptConfigs);
    }
    if (elements.savePromptsBtn) {
      elements.savePromptsBtn.addEventListener("click", savePromptConfigs);
    }
  }

  function handleAIProviderChange() {
    const provider = elements.aiProvider?.value || 'google';
    
    // 隱藏所有擴展設定
    if (elements.nvidiaExtSettings) {
      elements.nvidiaExtSettings.style.display = 'none';
    }
    if (elements.zaiExtSettings) {
      elements.zaiExtSettings.style.display = 'none';
    }
    
    // 顯示對應的擴展設定
    if (provider === 'nvidia' && elements.nvidiaExtSettings) {
      elements.nvidiaExtSettings.style.display = 'block';
    } else if (provider === 'zai' && elements.zaiExtSettings) {
      elements.zaiExtSettings.style.display = 'block';
    }
  }

  function handleSelfProbeToggle() {
    const isEnabled = elements.enableSelfProbe.checked;
    if (elements.selfProbeIntervalGroup) {
      elements.selfProbeIntervalGroup.style.opacity = isEnabled ? "1" : "0.5";
    }
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

  // ============ Self-Probe Settings ============

  async function loadSelfProbeSettings() {
    try {
      const response = await fetch(`${API_BASE}/api/settings/self-probe`);
      const data = await response.json();

      if (data.success) {
        const settings = data.settings || {};
        const stats = data.stats || {};

        if (elements.enableSelfProbe) {
          elements.enableSelfProbe.checked = settings.enabled || false;
        }
        if (elements.selfProbeInterval) {
          elements.selfProbeInterval.value = settings.intervalSeconds || 300;
        }

        // 更新狀態資訊
        updateSelfProbeStatus(stats);
        handleSelfProbeToggle();
      }
    } catch (error) {
      console.error("Failed to load Self-Probe settings:", error);
    }
  }

  function updateSelfProbeStatus(stats) {
    if (!elements.selfProbeStatus) return;

    if (stats.enabled) {
      elements.selfProbeStatus.style.display = "block";
      
      if (elements.selfProbeRunning) {
        elements.selfProbeRunning.textContent = `執行狀態: ${stats.isRunning ? "✅ 運行中" : "⏸️ 已停止"}`;
      }
      if (elements.selfProbeCount) {
        elements.selfProbeCount.textContent = `探查次數: ${stats.probeCount || 0}`;
      }
      if (elements.selfProbeLastTime) {
        const lastTime = stats.lastProbeTime 
          ? new Date(stats.lastProbeTime).toLocaleString() 
          : "尚未執行";
        elements.selfProbeLastTime.textContent = `上次探查: ${lastTime}`;
      }
    } else {
      elements.selfProbeStatus.style.display = "none";
    }
  }

  async function saveSelfProbeSettings() {
    const settings = {
      enabled: elements.enableSelfProbe?.checked || false,
      intervalSeconds: parseInt(elements.selfProbeInterval?.value) || 300,
    };

    // 驗證間隔
    if (settings.intervalSeconds < 60 || settings.intervalSeconds > 600) {
      showToast("探查間隔必須在 60-600 秒之間", "error");
      return;
    }

    if (elements.saveSelfProbeBtn) {
      elements.saveSelfProbeBtn.disabled = true;
      elements.saveSelfProbeBtn.textContent = "儲存中...";
    }

    try {
      const response = await fetch(`${API_BASE}/api/settings/self-probe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast("Self-Probe 設定已儲存", "success");
        updateSelfProbeStatus(data.stats);
      } else {
        showToast(`儲存失敗: ${data.error || "未知錯誤"}`, "error");
      }
    } catch (error) {
      console.error("Save Self-Probe settings failed:", error);
      showToast("儲存失敗", "error");
    } finally {
      if (elements.saveSelfProbeBtn) {
        elements.saveSelfProbeBtn.disabled = false;
        elements.saveSelfProbeBtn.textContent = "儲存設定";
      }
    }
  }

  // ============ Prompt Config Functions ============

  let promptConfigs = [];

  async function loadPromptConfigs() {
    if (!elements.promptConfigList) return;

    try {
      const response = await fetch(`${API_BASE}/api/settings/prompts`);
      const data = await response.json();

      if (data.success && data.prompts) {
        promptConfigs = data.prompts;
        renderPromptConfigs();
      } else {
        elements.promptConfigList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">無法載入配置</div>';
      }
    } catch (error) {
      console.error("Load prompt configs failed:", error);
      elements.promptConfigList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">載入失敗</div>';
    }
  }

  function renderPromptConfigs() {
    if (!elements.promptConfigList || !promptConfigs.length) return;

    const showEditor = (id) => id !== 'user_context' && id !== 'tool_results';

    elements.promptConfigList.innerHTML = promptConfigs.map(config => `
      <div class="prompt-config-item" data-id="${config.id}" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: ${showEditor(config.id) ? '12px' : '0'};">
          <span style="font-weight: 600; color: var(--text-primary); font-size: 14px;">${config.displayName}</span>
          <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary);">
              第一次:
              <input type="number" class="first-order form-input" value="${config.firstOrder}" min="0" max="1000" step="10" style="width: 60px; padding: 4px 8px;">
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary);">
              第二次:
              <input type="number" class="second-order form-input" value="${config.secondOrder}" min="0" max="1000" step="10" style="width: 60px; padding: 4px 8px;">
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
              <input type="checkbox" class="prompt-enabled" ${config.enabled ? 'checked' : ''}>
              啟用
            </label>
          </div>
        </div>
        ${showEditor(config.id) ? `
        <textarea class="prompt-content form-textarea" style="min-height: 100px;">${config.content || ''}</textarea>
        ` : ''}
      </div>
    `).join('');
  }

  async function savePromptConfigs() {
    if (!elements.savePromptsBtn) return;

    elements.savePromptsBtn.disabled = true;
    elements.savePromptsBtn.textContent = "儲存中...";

    try {
      const items = document.querySelectorAll('.prompt-config-item');
      const updates = [];

      items.forEach(item => {
        const id = item.dataset.id;
        const firstOrder = parseInt(item.querySelector('.first-order').value) || 0;
        const secondOrder = parseInt(item.querySelector('.second-order').value) || 0;
        const enabled = item.querySelector('.prompt-enabled').checked;
        const contentEl = item.querySelector('.prompt-content');
        const content = contentEl ? contentEl.value || null : null;

        updates.push({ id, firstOrder, secondOrder, enabled, content });
      });

      const response = await fetch(`${API_BASE}/api/settings/prompts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts: updates })
      });

      const data = await response.json();

      if (data.success) {
        showToast("提示詞配置已儲存", "success");
        if (data.prompts) {
          promptConfigs = data.prompts;
        }
      } else {
        showToast(`儲存失敗: ${data.error || "未知錯誤"}`, "error");
      }
    } catch (error) {
      console.error("Save prompt configs failed:", error);
      showToast("儲存失敗", "error");
    } finally {
      elements.savePromptsBtn.disabled = false;
      elements.savePromptsBtn.textContent = "儲存提示詞設定";
    }
  }

  async function resetPromptConfigs() {
    if (!confirm("確定要重置為預設配置？")) return;
    if (!elements.resetPromptsBtn) return;

    elements.resetPromptsBtn.disabled = true;
    elements.resetPromptsBtn.textContent = "重置中...";

    try {
      const response = await fetch(`${API_BASE}/api/settings/prompts/reset`, { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        showToast("已重置為預設配置", "success");
        if (data.prompts) {
          promptConfigs = data.prompts;
          renderPromptConfigs();
        }
      } else {
        showToast(`重置失敗: ${data.error || "未知錯誤"}`, "error");
      }
    } catch (error) {
      console.error("Reset prompt configs failed:", error);
      showToast("重置失敗", "error");
    } finally {
      elements.resetPromptsBtn.disabled = false;
      elements.resetPromptsBtn.textContent = "恢復預設";
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

