/**
 * feedback-handler.js
 * 反饋處理和 AI 回覆模組
 * 包含反饋提交、AI 回覆生成、MCP 工具調用等功能
 */

import {
  getSessionId,
  getWorkSummary,
  getCurrentImages,
  getCurrentProjectName,
  getCurrentProjectPath,
  getMaxToolRounds,
  getDebugMode,
  getStreamingAbortController,
  setStreamingAbortController,
  getAutoReplyData,
  setAutoReplyData,
  getAutoReplyConfirmationTimeout,
  setAutoReplyConfirmationTimeout,
} from "./state-manager.js";

import {
  showToast,
  showAlertModal,
  hideAlertModal,
  showLoadingOverlay,
  hideLoadingOverlay,
  updateCharCount,
  escapeHtml,
} from "./ui-helpers.js";

import { emitSubmitFeedback, emitUserActivity } from "./socket-manager.js";
import { clearImages } from "./image-handler.js";
import { stopAllTimers } from "./timer-controller.js";
import { getPinnedPromptsContent } from "./prompt-manager.js";

/**
 * 處理使用者活動
 */
export function handleUserActivity() {
  emitUserActivity();
}

/**
 * 提交反饋
 */
export async function submitFeedback() {
  const text = document.getElementById("feedbackText").value.trim();
  const currentImages = getCurrentImages();
  const sessionId = getSessionId();

  if (!text && currentImages.length === 0) {
    showToast("error", "錯誤", "請提供文字回應或上傳圖片");
    return;
  }

  if (!sessionId) {
    showToast("error", "錯誤", "會話 ID 不存在");
    return;
  }

  showAlertModal("提交中", "正在提交反饋，請稍候...");

  const feedbackData = {
    sessionId: sessionId,
    text: text,
    images: currentImages,
    timestamp: Date.now(),
    shouldCloseAfterSubmit: false,
  };

  stopAllTimers();
  emitSubmitFeedback(feedbackData);
}

/**
 * 清除所有輸入
 */
export function clearInputs() {
  document.getElementById("feedbackText").value = "";
  updateCharCount();
  clearImages();
}

/**
 * 選擇性清除提交輸入
 */
export function clearSubmissionInputs() {
  document.getElementById("feedbackText").value = "";
  updateCharCount();
  clearImages();
  stopAllTimers();
}

/**
 * 生成 AI 回覆 (無 MCP 工具)
 */
export async function generateAIReply() {
  const workSummary = getWorkSummary();
  if (!workSummary) {
    showToast("error", "錯誤", "無法取得 AI 訊息");
    return;
  }

  const userContext = document.getElementById("feedbackText").value;
  showLoadingOverlay("正在生成 AI 回覆...");

  try {
    const response = await fetch("/api/ai-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aiMessage: workSummary,
        userContext: userContext,
        projectName: getCurrentProjectName() || undefined,
        projectPath: getCurrentProjectPath() || undefined,
      }),
    });

    const data = await response.json();

    if (data.success) {
      const pinnedPromptsContent = await getPinnedPromptsContent();
      let finalReply = data.reply;
      if (pinnedPromptsContent) {
        finalReply = pinnedPromptsContent + "\n\n" + data.reply;
      }

      document.getElementById("feedbackText").value = finalReply;
      updateCharCount();

      // 如果是 CLI 模式，顯示包含 prompt 的詳細彈窗
      if (data.mode === "cli" && data.promptSent) {
        showCLIResultModal(data.cliTool, data.promptSent, finalReply);
      } else {
        showAlertModal("AI 已完成回覆", "AI 已經生成回覆，請檢查後提交。");
      }
    } else {
      // 如果是 CLI 模式失敗，也顯示 prompt
      if (data.mode === "cli" && data.promptSent) {
        showCLIResultModal(data.cliTool, data.promptSent, null, data.error);
      } else {
        showToast("error", "AI 回覆失敗", data.error);
      }
    }
  } catch (error) {
    console.error("生成 AI 回覆失敗:", error);
    showToast("error", "錯誤", "無法生成 AI 回覆");
  } finally {
    hideLoadingOverlay();
  }
}

/**
 * 顯示 CLI 執行結果彈窗（包含傳送的 prompt）
 * @param {string} cliTool - CLI 工具名稱
 * @param {string} promptSent - 傳送的 prompt
 * @param {string|null} reply - AI 回覆（成功時）
 * @param {string|null} error - 錯誤訊息（失敗時）
 */
function showCLIResultModal(cliTool, promptSent, reply = null, error = null) {
  const modal = document.getElementById("alertModal");
  if (!modal) return;

  const titleEl = document.getElementById("alertModalTitle");
  const bodyEl = document.getElementById("alertModalBody");

  const isSuccess = reply !== null;
  const title = isSuccess
    ? `✅ CLI 回覆完成 (${cliTool})`
    : `❌ CLI 回覆失敗 (${cliTool})`;

  if (titleEl) titleEl.textContent = title;

  if (bodyEl) {
    bodyEl.innerHTML = `
      <details class="cli-prompt-details" style="margin-bottom: 12px;">
        <summary style="cursor: pointer; color: var(--text-secondary); font-size: 13px;">
          📤 傳送給 CLI 的 Prompt（點擊展開）
        </summary>
        <pre style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; margin-top: 8px; max-height: 200px; overflow-y: auto; font-size: 12px; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(promptSent)}</pre>
      </details>
      ${
        isSuccess
          ? '<p style="color: var(--text-primary);">AI 已經生成回覆，請檢查後提交。</p>'
          : `<p style="color: var(--accent-red);">錯誤: ${escapeHtml(error || "未知錯誤")}</p>`
      }
    `;
  }

  modal.classList.add("show");
}

/**
 * 解析 AI 回覆中的 tool_calls JSON
 */
export function parseToolCalls(aiResponse) {
  const jsonBlockMatch = aiResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  let jsonContent = null;

  if (jsonBlockMatch && jsonBlockMatch[1]) {
    jsonContent = jsonBlockMatch[1].trim();
  } else {
    const jsonMatch = aiResponse.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }
  }

  if (!jsonContent) {
    return { hasToolCalls: false, toolCalls: [], message: aiResponse };
  }

  try {
    const parsed = JSON.parse(jsonContent);

    if (!Array.isArray(parsed.tool_calls)) {
      return { hasToolCalls: false, toolCalls: [], message: aiResponse };
    }

    for (const call of parsed.tool_calls) {
      if (typeof call.name !== "string" || typeof call.arguments !== "object") {
        return { hasToolCalls: false, toolCalls: [], message: aiResponse };
      }
    }

    return {
      hasToolCalls: parsed.tool_calls.length > 0,
      toolCalls: parsed.tool_calls,
      message: parsed.message || null,
    };
  } catch {
    return { hasToolCalls: false, toolCalls: [], message: aiResponse };
  }
}

/**
 * 執行 MCP 工具
 */
export async function executeMCPTools(toolCalls) {
  const response = await fetch("/api/mcp/execute-tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tools: toolCalls }),
  });

  const data = await response.json();
  return data.results || [];
}

/**
 * 格式化工具執行結果
 */
export function formatToolResults(results) {
  const lines = ["Tool execution results:"];
  for (const result of results) {
    if (result.success) {
      lines.push(`- ${result.name}: SUCCESS`);
      if (result.result !== undefined) {
        const resultStr =
          typeof result.result === "string"
            ? result.result
            : JSON.stringify(result.result, null, 2);
        lines.push(`  Result: ${resultStr}`);
      }
    } else {
      lines.push(`- ${result.name}: FAILED`);
      if (result.error) {
        lines.push(`  Error: ${result.error}`);
      }
    }
  }
  return lines.join("\n");
}

/**
 * 顯示 AI Streaming Panel
 */
export function showStreamingPanel() {
  const panel = document.getElementById("aiStreamingPanel");
  const progressContainer = document.getElementById("streamingProgress");
  const outputContainer = document.getElementById("streamingOutput");

  if (panel) {
    panel.style.display = "flex";
    if (progressContainer) progressContainer.innerHTML = "";
    if (outputContainer)
      outputContainer.innerHTML = '<span class="streaming-cursor"></span>';
    updateStreamingStatus("thinking", "準備中...");

    const cancelBtn = document.getElementById("cancelStreaming");
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        const controller = getStreamingAbortController();
        if (controller) {
          controller.abort();
        }
        hideStreamingPanel();
      };
    }
  }
}

/**
 * 隱藏 AI Streaming Panel
 */
export function hideStreamingPanel() {
  const panel = document.getElementById("aiStreamingPanel");
  if (panel) {
    panel.style.display = "none";
  }
  setStreamingAbortController(null);
}

/**
 * 更新 Streaming 狀態
 */
export function updateStreamingStatus(status, text) {
  const indicator = document.getElementById("streamingStatusIndicator");
  const statusText = document.getElementById("streamingStatus");
  const title = document.getElementById("streamingTitle");

  if (indicator) {
    indicator.className = "status-indicator " + status;
  }
  if (statusText) {
    statusText.textContent = text;
  }

  const titleMap = {
    thinking: "AI 思考中...",
    executing: "執行工具中...",
    done: "AI 回覆完成",
    error: "發生錯誤",
  };
  if (title && titleMap[status]) {
    title.textContent = titleMap[status];
  }
}

/**
 * 添加進度項目到 Streaming Panel
 */
export function addStreamingProgress(
  status,
  message,
  toolCalls = [],
  round = 1
) {
  const container = document.getElementById("streamingProgress");
  if (!container) return;

  const maxToolRounds = getMaxToolRounds();
  const statusIcons = {
    thinking: "🤔",
    executing: "⏳",
    done: "✅",
    error: "❌",
  };

  const prevItems = container.querySelectorAll(".progress-item.active");
  prevItems.forEach((item) => {
    item.classList.remove("active");
    item.classList.add("completed");
  });

  const item = document.createElement("div");
  item.className = `progress-item ${
    status === "done" || status === "error" ? status : "active"
  }`;

  let toolsHtml = "";
  if (toolCalls.length > 0) {
    toolsHtml = `<div class="progress-tools">${toolCalls
      .map((t) => `<span class="tool-tag">${t.name}</span>`)
      .join("")}</div>`;
  }

  item.innerHTML = `
    <span class="progress-icon">${statusIcons[status] || "⏳"}</span>
    <div class="progress-content">
      <div class="progress-message">Round ${round}/${maxToolRounds}: ${message}</div>
      ${toolsHtml}
    </div>
  `;

  container.appendChild(item);
  container.scrollTop = container.scrollHeight;
  updateStreamingStatus(status, message);
}

/**
 * 添加輸出內容到 Streaming Panel
 */
export function addStreamingOutput(content, type = "ai-message") {
  const container = document.getElementById("streamingOutput");
  if (!container) return;

  const cursor = container.querySelector(".streaming-cursor");

  const typeClasses = {
    "tool-call": "tool-call-display",
    "tool-result": "tool-result-display",
    "ai-message": "ai-message",
    error: "error-message",
  };

  const details = document.createElement("details");
  details.className = typeClasses[type] || "ai-message";
  details.open = true;

  const summary = document.createElement("summary");
  const contentDiv = document.createElement("div");
  contentDiv.className = "details-content";

  if (type === "tool-call") {
    summary.innerHTML = `🔧 調用工具`;
    contentDiv.innerHTML = `<pre>${escapeHtml(content)}</pre>`;
  } else if (type === "tool-result") {
    const isSuccess = content.includes("SUCCESS");
    const statusIcon = isSuccess ? "✅" : "❌";
    summary.innerHTML = `📋 工具結果 ${statusIcon}`;
    contentDiv.innerHTML = `<pre>${escapeHtml(content)}</pre>`;
  } else if (type === "error") {
    summary.innerHTML = `❌ 錯誤`;
    contentDiv.innerHTML = escapeHtml(content);
    details.style.color = "var(--accent-red)";
  } else {
    summary.innerHTML = `💬 AI 回應`;
    contentDiv.textContent = content;
  }

  details.appendChild(summary);
  details.appendChild(contentDiv);
  container.appendChild(details);

  if (cursor) {
    container.appendChild(cursor);
  }

  container.scrollTop = container.scrollHeight;
}

/**
 * 顯示第 5 輪確認對話框
 */
function showRound5Confirmation() {
  return new Promise((resolve) => {
    showAlertModal(
      "工具呼叫已達最大輪次",
      "AI 已執行 5 輪工具呼叫，是否繼續讓 AI 完成回覆？\n\n點擊「確定」繼續，點擊「取消」停止。",
      () => resolve(true),
      () => resolve(false)
    );
  });
}

/**
 * 更新工具執行進度 UI
 */
function updateToolProgressUI(round, status, message, toolCalls = []) {
  addStreamingProgress(status, message, toolCalls, round);
}

/**
 * 帶 MCP 工具呼叫支援的 AI 回覆生成
 */
export async function generateAIReplyWithTools() {
  const workSummary = getWorkSummary();
  if (!workSummary) {
    showToast("error", "錯誤", "無法取得 AI 訊息");
    return;
  }

  const userContext = document.getElementById("feedbackText").value;
  const maxToolRounds = getMaxToolRounds();
  const debugMode = getDebugMode();

  let hasMCPTools = false;
  try {
    const toolsResponse = await fetch("/api/mcp-tools");
    const toolsData = await toolsResponse.json();
    hasMCPTools =
      toolsData.success && toolsData.tools && toolsData.tools.length > 0;
  } catch {
    hasMCPTools = false;
  }

  if (!hasMCPTools) {
    return generateAIReply();
  }

  showStreamingPanel();
  const controller = new AbortController();
  setStreamingAbortController(controller);

  let round = 0;
  let toolResults = "";

  try {
    while (round < maxToolRounds) {
      if (controller.signal.aborted) {
        throw new Error("使用者取消操作");
      }

      round++;
      updateToolProgressUI(round, "thinking", "AI 思考中...");

      const response = await fetch("/api/ai-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiMessage: workSummary,
          userContext: userContext,
          includeMCPTools: true,
          toolResults: toolResults || undefined,
          projectName: getCurrentProjectName() || undefined,
          projectPath: getCurrentProjectPath() || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        addStreamingOutput(data.error || "AI 回覆失敗", "error");
        updateStreamingStatus("error", "AI 回覆失敗");
        showToast("error", "AI 回覆失敗", data.error);
        return;
      }

      addStreamingOutput(data.reply, "ai-message");
      const parsed = parseToolCalls(data.reply);

      if (!parsed.hasToolCalls) {
        updateToolProgressUI(round, "done", "完成!");

        const pinnedPromptsContent = await getPinnedPromptsContent();
        let finalReply = parsed.message || data.reply;
        if (pinnedPromptsContent) {
          finalReply = pinnedPromptsContent + "\n\n" + finalReply;
        }

        document.getElementById("feedbackText").value = finalReply;
        updateCharCount();

        await new Promise((r) => setTimeout(r, 1000));
        hideStreamingPanel();
        showAlertModal("AI 已完成回覆", "AI 已經生成回覆，請檢查後提交。");
        return;
      }

      updateToolProgressUI(
        round,
        "executing",
        "執行工具中...",
        parsed.toolCalls
      );

      const toolCallsDisplay = parsed.toolCalls
        .map((t) => `${t.name}(${JSON.stringify(t.arguments, null, 2)})`)
        .join("\n\n");
      addStreamingOutput(toolCallsDisplay, "tool-call");

      if (parsed.message) {
        console.log(`[Round ${round}] AI: ${parsed.message}`);
      }

      const results = await executeMCPTools(parsed.toolCalls);
      toolResults = formatToolResults(results);
      addStreamingOutput(toolResults, "tool-result");

      if (round === maxToolRounds) {
        updateToolProgressUI(round, "done", "已達最大輪次");

        const shouldContinue = await showRound5Confirmation();
        if (!shouldContinue) {
          const pinnedPromptsContent = await getPinnedPromptsContent();
          let finalReply =
            parsed.message ||
            "AI 工具呼叫已達最大輪次，請手動完成回覆。\n\n" + toolResults;
          if (pinnedPromptsContent) {
            finalReply = pinnedPromptsContent + "\n\n" + finalReply;
          }
          document.getElementById("feedbackText").value = finalReply;
          updateCharCount();
          if (!debugMode) hideStreamingPanel();
          return;
        }
        round = 0;
      }
    }
  } catch (error) {
    console.error("MCP AI 回覆失敗:", error);
    if (error.message !== "使用者取消操作") {
      addStreamingOutput(error.message || "無法生成 AI 回覆", "error");
      showToast("error", "錯誤", "無法生成 AI 回覆");
    }
  } finally {
    if (!debugMode) hideStreamingPanel();
  }
}

/**
 * 觸發自動 AI 回應
 */
export async function triggerAutoAIReply() {
  console.log("觸發自動 AI 回應...");
  const maxToolRounds = getMaxToolRounds();
  const debugMode = getDebugMode();

  const timerEl = document.getElementById("auto-reply-timer");
  if (timerEl) {
    timerEl.classList.remove("active");
  }

  const workSummary = getWorkSummary();
  if (!workSummary) {
    console.error("無法取得 AI 訊息");
    showToast("error", "錯誤", "無法取得 AI 訊息，自動回覆失敗");
    return;
  }

  const userContext = document.getElementById("feedbackText").value;

  let hasMCPTools = false;
  try {
    const toolsResponse = await fetch("/api/mcp-tools");
    const toolsData = await toolsResponse.json();
    hasMCPTools =
      toolsData.success && toolsData.tools && toolsData.tools.length > 0;
  } catch {
    hasMCPTools = false;
  }

  if (!hasMCPTools) {
    showLoadingOverlay("正在自動生成 AI 回覆...");
    try {
      const response = await fetch("/api/ai-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiMessage: workSummary,
          userContext: userContext,
          projectName: getCurrentProjectName() || undefined,
          projectPath: getCurrentProjectPath() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const pinnedPromptsContent = await getPinnedPromptsContent();
        let finalReply = data.reply;
        if (pinnedPromptsContent) {
          finalReply = pinnedPromptsContent + "\n\n" + data.reply;
        }
        document.getElementById("feedbackText").value = finalReply;
        updateCharCount();
        hideLoadingOverlay();
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
    return;
  }

  showStreamingPanel();
  const controller = new AbortController();
  setStreamingAbortController(controller);

  const title = document.getElementById("streamingTitle");
  if (title) title.textContent = "自動 AI 回覆中...";

  let round = 0;
  let toolResults = "";
  let finalReply = "";

  try {
    while (round < maxToolRounds) {
      if (controller.signal.aborted) {
        throw new Error("使用者取消操作");
      }

      round++;
      updateToolProgressUI(round, "thinking", "AI 思考中...");

      const response = await fetch("/api/ai-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiMessage: workSummary,
          userContext: userContext,
          includeMCPTools: true,
          toolResults: toolResults || undefined,
          projectName: getCurrentProjectName() || undefined,
          projectPath: getCurrentProjectPath() || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        addStreamingOutput(data.error || "AI 回覆失敗", "error");
        updateStreamingStatus("error", "AI 回覆失敗");
        showToast("error", "AI 回覆失敗", data.error);
        return;
      }

      addStreamingOutput(data.reply, "ai-message");
      const parsed = parseToolCalls(data.reply);

      if (!parsed.hasToolCalls) {
        updateToolProgressUI(round, "done", "完成!");
        finalReply = parsed.message || data.reply;
        break;
      }

      updateToolProgressUI(
        round,
        "executing",
        "執行工具中...",
        parsed.toolCalls
      );

      const toolCallsDisplay = parsed.toolCalls
        .map((t) => `${t.name}(${JSON.stringify(t.arguments, null, 2)})`)
        .join("\n\n");
      addStreamingOutput(toolCallsDisplay, "tool-call");

      const results = await executeMCPTools(parsed.toolCalls);
      toolResults = formatToolResults(results);
      addStreamingOutput(toolResults, "tool-result");

      if (round === maxToolRounds) {
        updateToolProgressUI(round, "done", "已達最大輪次");
        finalReply =
          parsed.message || "AI 工具呼叫已達最大輪次。\n\n" + toolResults;
        break;
      }
    }

    const pinnedPromptsContent = await getPinnedPromptsContent();
    if (pinnedPromptsContent) {
      finalReply = pinnedPromptsContent + "\n\n" + finalReply;
    }

    document.getElementById("feedbackText").value = finalReply;
    updateCharCount();

    await new Promise((r) => setTimeout(r, 1000));
    if (!debugMode) hideStreamingPanel();

    showAutoReplyConfirmModal(finalReply);
  } catch (error) {
    console.error("自動生成 AI 回覆失敗:", error);
    if (error.message !== "使用者取消操作") {
      addStreamingOutput(error.message || "無法自動生成 AI 回覆", "error");
      showToast("error", "錯誤", "無法自動生成 AI 回覆");
    }
  } finally {
    if (!debugMode) hideStreamingPanel();
  }
}

/**
 * 顯示自動回覆確認模態框
 */
export function showAutoReplyConfirmModal(replyContent) {
  const modal = document.getElementById("autoReplyConfirmModal");
  const preview = document.getElementById("autoReplyPreview");
  const countdown = document.getElementById("autoReplyCountdown");

  if (!modal) {
    console.warn("自動回覆確認模態框未找到");
    return;
  }

  preview.textContent = replyContent;
  modal.style.display = "flex";
  setAutoReplyData(replyContent);

  const totalSeconds = 10;
  countdown.textContent = totalSeconds;

  let remainingSeconds = totalSeconds;
  const existingTimeout = getAutoReplyConfirmationTimeout();
  if (existingTimeout) {
    clearInterval(existingTimeout);
  }

  const intervalId = setInterval(() => {
    remainingSeconds--;
    countdown.textContent = remainingSeconds;

    if (remainingSeconds <= 0) {
      clearInterval(intervalId);
      setAutoReplyConfirmationTimeout(null);
      console.log("10 秒倒數結束，自動提交回應");
      confirmAutoReplySubmit();
    }
  }, 1000);

  setAutoReplyConfirmationTimeout(intervalId);
}

/**
 * 隱藏自動回覆確認模態框
 */
export function hideAutoReplyConfirmModal() {
  const modal = document.getElementById("autoReplyConfirmModal");
  if (modal) {
    modal.style.display = "none";
  }

  const timeout = getAutoReplyConfirmationTimeout();
  if (timeout) {
    clearInterval(timeout);
    setAutoReplyConfirmationTimeout(null);
  }
}

/**
 * 確認自動回覆提交
 */
export function confirmAutoReplySubmit() {
  hideAutoReplyConfirmModal();

  const autoReplyData = getAutoReplyData();
  if (autoReplyData) {
    document.getElementById("feedbackText").value = autoReplyData;
    updateCharCount();
    setAutoReplyData(null);
    console.log("確認自動回覆，提交反饋");
    submitFeedback();
  }
}

/**
 * 取消自動回覆
 */
export function cancelAutoReplyConfirm() {
  hideAutoReplyConfirmModal();
  setAutoReplyData(null);
  console.log("已取消自動回覆");
}

export default {
  handleUserActivity,
  submitFeedback,
  clearInputs,
  clearSubmissionInputs,
  generateAIReply,
  generateAIReplyWithTools,
  parseToolCalls,
  executeMCPTools,
  formatToolResults,
  showStreamingPanel,
  hideStreamingPanel,
  updateStreamingStatus,
  addStreamingProgress,
  addStreamingOutput,
  triggerAutoAIReply,
  showAutoReplyConfirmModal,
  hideAutoReplyConfirmModal,
  confirmAutoReplySubmit,
  cancelAutoReplyConfirm,
};
