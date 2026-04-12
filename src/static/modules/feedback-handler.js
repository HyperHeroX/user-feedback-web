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
import {
  showConversationPanel,
  hideConversationPanel,
  addConversationEntry,
  addDebugEntry,
  clearConversationPanel,
  updateConversationMode,
  updateConversationTitle,
  addThinkingEntry,
  removeThinkingEntry,
  ConversationEntryType,
} from "./conversation-panel.js";

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
 * 生成 AI 回覆 (無 MCP 工具) - 使用新的 Conversation Panel
 */
export async function generateAIReply() {
  const workSummary = getWorkSummary();
  if (!workSummary) {
    showConversationPanel();
    updateConversationTitle("AI 回覆");
    addConversationEntry(ConversationEntryType.ERROR, "目前沒有活躍的 AI 工作匯報。\n\n可能原因：\n1. 尚未有 AI 代理透過 MCP 發送工作匯報\n2. 會話已過期或尚未建立\n3. 伺服器剛重啟，尚未收到任何匯報", {
      title: "無法取得 AI 訊息",
      collapsed: false,
      timestamp: Date.now(),
    });
    showToast("error", "錯誤", "無法取得 AI 訊息");
    return;
  }

  // 第一輪不需要 userContext（用戶回覆）
  // 只傳送 AI 工作匯報 + 系統提示詞 + 釘選提示詞
  const userContext = "";

  showConversationPanel();
  updateConversationTitle("AI 回覆");
  clearConversationPanel();

  try {
    const requestBody = {
      aiMessage: workSummary,
      userContext: userContext,
      projectName: getCurrentProjectName() || undefined,
      projectPath: getCurrentProjectPath() || undefined,
    };

    // 先獲取完整提示詞預覽
    let fullPrompt = buildLocalPromptPreview(workSummary, userContext, null);
    let currentMode = "pending";
    let currentCliTool = null;
    
    try {
      const previewResponse = await fetch("/api/prompt-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const previewData = await previewResponse.json();
      if (previewData.success && previewData.prompt) {
        fullPrompt = previewData.prompt;
        currentMode = previewData.mode;
        currentCliTool = previewData.cliTool;
      }
    } catch (previewError) {
      console.warn("無法獲取完整提示詞預覽，使用本地預覽:", previewError);
    }

    const modeLabel = currentMode === "cli" ? `CLI (${currentCliTool})` : currentMode === "api" ? "API" : "準備中";
    addConversationEntry(ConversationEntryType.PROMPT, fullPrompt, {
      title: `提示詞 (${modeLabel})`,
      collapsed: false,
      timestamp: Date.now(),
    });

    updateConversationMode(currentMode, currentCliTool);
    addThinkingEntry("AI 思考中...");

    const response = await fetch("/api/ai-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    removeThinkingEntry();

    if (data.debug) {
      addDebugEntry(data.debug, {
        title: "Debug 資訊",
        collapsed: true,
        timestamp: Date.now(),
        badge: data.debug.elapsedMs ? `${data.debug.elapsedMs}ms` : undefined,
      });
    }

    if (data.success) {
      updateConversationMode(data.mode, data.cliTool);

      if (data.fallbackReason) {
        showToast("warning", "模式切換", data.fallbackReason);
      }

      if (data.promptSent) {
        const promptEntries = document.querySelectorAll(".entry-prompt");
        if (promptEntries.length > 0) {
          const promptContent = promptEntries[0].querySelector(".entry-content");
          if (promptContent) {
            promptContent.textContent = data.promptSent;
          }
        }
      }

      const pinnedPromptsContent = await getPinnedPromptsContent();
      let finalReply = data.reply;
      if (pinnedPromptsContent) {
        finalReply = pinnedPromptsContent + "\n\n以下為我的回覆:\n" + data.reply;
      } else {
        finalReply = "以下為我的回覆:\n" + data.reply;
      }

      document.getElementById("feedbackText").value = finalReply;
      updateCharCount();

      let badge = data.mode === "cli" ? `CLI (${data.cliTool})` : "API";
      if (data.fallbackReason) {
        badge = "API (fallback)";
      }

      addConversationEntry(ConversationEntryType.AI, finalReply, {
        title: "AI 回覆",
        collapsed: false,
        timestamp: Date.now(),
        badge: badge,
      });

      const modeLabel = data.mode === "cli" ? `CLI (${data.cliTool})` : "API";
      showToast("success", "完成", `AI 回覆完成 (${modeLabel})`);
    } else {
      addConversationEntry(ConversationEntryType.ERROR, data.error || "未知錯誤", {
        title: "錯誤",
        collapsed: false,
        timestamp: Date.now(),
      });

      const modeLabel = data.mode === "cli" ? `CLI (${data.cliTool})` : "API";
      showToast("error", "失敗", `AI 回覆失敗 (${modeLabel})`);
    }
  } catch (error) {
    console.error("生成 AI 回覆失敗:", error);
    removeThinkingEntry();
    addConversationEntry(ConversationEntryType.ERROR, error.message || "無法生成 AI 回覆", {
      title: "錯誤",
      collapsed: false,
      timestamp: Date.now(),
    });
    showToast("error", "錯誤", "無法生成 AI 回覆");
  }
}

/**
 * 將 streaming panel 的取消按鈕轉換為確定按鈕
 */
function transformToConfirmButton() {
  const cancelBtn = document.getElementById("cancelStreaming");
  if (cancelBtn) {
    cancelBtn.textContent = "確定";
    cancelBtn.classList.remove("btn-secondary");
    cancelBtn.classList.add("btn-primary");
    cancelBtn.onclick = () => {
      hideStreamingPanel();
      cancelBtn.textContent = "取消";
      cancelBtn.classList.remove("btn-primary");
      cancelBtn.classList.add("btn-secondary");
    };
  }
}

/**
 * 顯示 CLI 執行詳情（包含 prompt 和結果）
 * @param {string} cliTool - CLI 工具名稱
 * @param {string} promptSent - 傳送的 prompt
 * @param {string|null} reply - AI 回覆（成功時）
 * @param {string|null} error - 錯誤訊息（失敗時）
 */
function showCLIExecutionDetails(
  cliTool,
  promptSent,
  reply = null,
  error = null
) {
  const container = document.getElementById("streamingOutput");
  if (!container) return;

  // 清空現有內容
  container.innerHTML = "";

  // 顯示傳送的 prompt（可折疊）
  if (promptSent) {
    const promptDetails = document.createElement("details");
    promptDetails.className = "cli-prompt-details";
    promptDetails.open = true; // 預設展開讓用戶看到

    promptDetails.innerHTML = `
      <summary style="cursor: pointer; padding: 8px; background: var(--bg-tertiary); border-radius: 4px; margin-bottom: 8px;">
        📤 傳送給 ${cliTool} CLI 的 Prompt
      </summary>
      <pre style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin: 8px 0; max-height: 300px; overflow-y: auto; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; border: 1px solid var(--border-color);">${escapeHtml(
        promptSent
      )}</pre>
    `;
    container.appendChild(promptDetails);
  }

  // 顯示結果或錯誤
  if (reply) {
    const resultDiv = document.createElement("div");
    resultDiv.className = "cli-result success";
    resultDiv.innerHTML = `
      <details open>
        <summary style="cursor: pointer; padding: 8px; background: var(--accent-green-bg, rgba(34, 197, 94, 0.1)); border-radius: 4px; margin-bottom: 8px; color: var(--accent-green, #22c55e);">
          ✅ CLI 回覆結果
        </summary>
        <pre style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin: 8px 0; max-height: 300px; overflow-y: auto; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; border: 1px solid var(--border-color);">${escapeHtml(
          reply
        )}</pre>
      </details>
    `;
    container.appendChild(resultDiv);
  } else if (error) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "cli-result error";
    errorDiv.innerHTML = `
      <details open>
        <summary style="cursor: pointer; padding: 8px; background: var(--accent-red-bg, rgba(239, 68, 68, 0.1)); border-radius: 4px; margin-bottom: 8px; color: var(--accent-red, #ef4444);">
          ❌ CLI 執行錯誤
        </summary>
        <pre style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin: 8px 0; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; border: 1px solid var(--accent-red, #ef4444);">${escapeHtml(
          error
        )}</pre>
      </details>
    `;
    container.appendChild(errorDiv);
  }

  container.scrollTop = container.scrollHeight;
}

/**
 * 顯示 API 模式執行詳情
 */
function showAPIExecutionDetails(promptSent, reply) {
  const container = document.getElementById("streamingOutput");
  if (!container) return;

  // 清空現有內容
  container.innerHTML = "";

  // 顯示發送的提示詞
  if (promptSent) {
    const promptDiv = document.createElement("div");
    promptDiv.className = "cli-prompt-sent";
    promptDiv.innerHTML = `
      <details>
        <summary style="cursor: pointer; padding: 8px; background: var(--accent-blue-bg, rgba(59, 130, 246, 0.1)); border-radius: 4px; margin-bottom: 8px; color: var(--accent-blue, #3b82f6);">
          📤 發送的提示詞 (API 模式)
        </summary>
        <pre style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin: 8px 0; max-height: 300px; overflow-y: auto; font-size: 11px; white-space: pre-wrap; word-wrap: break-word; border: 1px solid var(--border-color);">${escapeHtml(
          promptSent
        )}</pre>
      </details>
    `;
    container.appendChild(promptDiv);
  }

  // 顯示 API 回覆結果
  const resultDiv = document.createElement("div");
  resultDiv.className = "api-result success";
  resultDiv.innerHTML = `
    <details open>
      <summary style="cursor: pointer; padding: 8px; background: var(--accent-green-bg, rgba(34, 197, 94, 0.1)); border-radius: 4px; margin-bottom: 8px; color: var(--accent-green, #22c55e);">
        ✅ AI 回覆結果 (API 模式)
      </summary>
      <pre style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin: 8px 0; max-height: 400px; overflow-y: auto; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; border: 1px solid var(--border-color);">${escapeHtml(
        reply
      )}</pre>
    </details>
  `;
  container.appendChild(resultDiv);

  container.scrollTop = container.scrollHeight;
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
 * 顯示提示詞預覽
 */
function showPromptPreview(prompt, round, mode, cliTool) {
  const container = document.getElementById("streamingOutput");
  if (!container) return;

  const modeLabel =
    mode === "pending"
      ? "準備中..."
      : mode === "cli"
      ? `CLI (${cliTool})`
      : "API";
  const promptDiv = document.createElement("div");
  promptDiv.className = "prompt-preview";
  promptDiv.id = `prompt-preview-${round}`;
  promptDiv.innerHTML = `
    <details open>
      <summary style="cursor: pointer; padding: 8px; background: var(--accent-blue-bg, rgba(59, 130, 246, 0.1)); border-radius: 4px; margin-bottom: 8px; color: var(--accent-blue, #3b82f6);">
        📤 Round ${round}: 發送的提示詞 (${modeLabel})
      </summary>
      <pre style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin: 8px 0; max-height: 300px; overflow-y: auto; font-size: 11px; white-space: pre-wrap; word-wrap: break-word; border: 1px solid var(--border-color);">${escapeHtml(
        prompt
      )}</pre>
    </details>
  `;
  container.appendChild(promptDiv);
  container.scrollTop = container.scrollHeight;
}

/**
 * 更新提示詞預覽為完整版本
 */
function updatePromptPreview(prompt, round, mode, cliTool) {
  console.log("[feedback-handler] updatePromptPreview called:", {
    round,
    mode,
    cliTool,
    promptLength: prompt?.length,
  });

  const promptDiv = document.getElementById(`prompt-preview-${round}`);
  if (!promptDiv) {
    console.warn(
      "[feedback-handler] prompt-preview element not found for round:",
      round
    );
    return;
  }

  const modeLabel = mode === "cli" ? `CLI (${cliTool})` : "API";
  promptDiv.innerHTML = `
    <details open>
      <summary style="cursor: pointer; padding: 8px; background: var(--accent-blue-bg, rgba(59, 130, 246, 0.1)); border-radius: 4px; margin-bottom: 8px; color: var(--accent-blue, #3b82f6);">
        📤 Round ${round}: 完整提示詞 (${modeLabel}) - 已更新
      </summary>
      <pre style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin: 8px 0; max-height: 300px; overflow-y: auto; font-size: 11px; white-space: pre-wrap; word-wrap: break-word; border: 1px solid var(--border-color);">${escapeHtml(
        prompt
      )}</pre>
    </details>
  `;
  console.log("[feedback-handler] prompt-preview updated successfully");
}

/**
 * 顯示 AI 回覆結果
 */
function showAIReplyResult(reply, round, mode, cliTool) {
  const container = document.getElementById("streamingOutput");
  if (!container) return;

  const modeLabel = mode === "cli" ? `CLI (${cliTool})` : "API";
  const resultDiv = document.createElement("div");
  resultDiv.className = "ai-reply-result";
  resultDiv.innerHTML = `
    <details open>
      <summary style="cursor: pointer; padding: 8px; background: var(--accent-green-bg, rgba(34, 197, 94, 0.1)); border-radius: 4px; margin-bottom: 8px; color: var(--accent-green, #22c55e);">
        ✅ Round ${round}: AI 回覆 (${modeLabel})
      </summary>
      <pre style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin: 8px 0; max-height: 400px; overflow-y: auto; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; border: 1px solid var(--border-color);">${escapeHtml(
        reply
      )}</pre>
    </details>
  `;
  container.appendChild(resultDiv);
  container.scrollTop = container.scrollHeight;
}

/**
 * 顯示工具呼叫
 */
function showToolCalls(toolCalls, round) {
  const container = document.getElementById("streamingOutput");
  if (!container) return;

  const toolCallsDisplay = toolCalls
    .map((t) => `${t.name}(${JSON.stringify(t.arguments, null, 2)})`)
    .join("\n\n");

  const toolDiv = document.createElement("div");
  toolDiv.className = "tool-calls";
  toolDiv.innerHTML = `
    <details open>
      <summary style="cursor: pointer; padding: 8px; background: var(--accent-orange-bg, rgba(249, 115, 22, 0.1)); border-radius: 4px; margin-bottom: 8px; color: var(--accent-orange, #f97316);">
        🔧 Round ${round}: 工具呼叫
      </summary>
      <pre style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin: 8px 0; max-height: 200px; overflow-y: auto; font-size: 11px; white-space: pre-wrap; word-wrap: break-word; border: 1px solid var(--border-color);">${escapeHtml(
        toolCallsDisplay
      )}</pre>
    </details>
  `;
  container.appendChild(toolDiv);
  container.scrollTop = container.scrollHeight;
}

/**
 * 顯示工具執行結果
 */
function showToolResults(results, round) {
  const container = document.getElementById("streamingOutput");
  if (!container) return;

  const resultDiv = document.createElement("div");
  resultDiv.className = "tool-results";
  resultDiv.innerHTML = `
    <details>
      <summary style="cursor: pointer; padding: 8px; background: var(--accent-purple-bg, rgba(168, 85, 247, 0.1)); border-radius: 4px; margin-bottom: 8px; color: var(--accent-purple, #a855f7);">
        📋 Round ${round}: 工具執行結果
      </summary>
      <pre style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin: 8px 0; max-height: 200px; overflow-y: auto; font-size: 11px; white-space: pre-wrap; word-wrap: break-word; border: 1px solid var(--border-color);">${escapeHtml(
        results
      )}</pre>
    </details>
  `;
  container.appendChild(resultDiv);
  container.scrollTop = container.scrollHeight;
}

/**
 * 構建前端提示詞預覽（簡化版 - 用於 API 獲取失敗時的後備方案）
 */
function buildLocalPromptPreview(workSummary, userContext, toolResults) {
  let preview = "";

  preview += "## AI 工作匯報\n";
  preview += workSummary + "\n\n";

  if (userContext) {
    preview += "## 使用者上下文\n";
    preview += userContext + "\n\n";
  }

  if (toolResults) {
    preview += "## 工具執行結果\n";
    preview += toolResults + "\n\n";
  }

  return preview;
}

/**
 * 帶 MCP 工具呼叫支援的 AI 回覆生成
 */
export async function generateAIReplyWithTools() {
  const workSummary = getWorkSummary();
  if (!workSummary) {
    showConversationPanel();
    updateConversationTitle("AI 回覆");
    addConversationEntry(ConversationEntryType.ERROR, "目前沒有活躍的 AI 工作匯報。\n\n可能原因：\n1. 尚未有 AI 代理透過 MCP 發送工作匯報\n2. 會話已過期或尚未建立\n3. 伺服器剛重啟，尚未收到任何匯報", {
      title: "無法取得 AI 訊息",
      collapsed: false,
      timestamp: Date.now(),
    });
    showToast("error", "錯誤", "無法取得 AI 訊息");
    return;
  }

  // 第一輪不需要 userContext（用戶回覆），只有後續輪次才需要
  // userContext 會在工具執行後由用戶填入回覆
  let userContext = "";
  const maxToolRounds = getMaxToolRounds();

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

  showConversationPanel();
  updateConversationTitle("AI 回覆 (含工具)");
  clearConversationPanel();

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

      const requestBody = {
        aiMessage: workSummary,
        userContext: userContext,
        includeMCPTools: true,
        toolResults: toolResults || undefined,
        projectName: getCurrentProjectName() || undefined,
        projectPath: getCurrentProjectPath() || undefined,
      };

      // 先獲取完整提示詞預覽
      let fullPrompt = buildLocalPromptPreview(workSummary, userContext, toolResults);
      let currentMode = "pending";
      let currentCliTool = null;
      
      try {
        const previewResponse = await fetch("/api/prompt-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const previewData = await previewResponse.json();
        if (previewData.success && previewData.prompt) {
          fullPrompt = previewData.prompt;
          currentMode = previewData.mode;
          currentCliTool = previewData.cliTool;
        }
      } catch (previewError) {
        console.warn("無法獲取完整提示詞預覽，使用本地預覽:", previewError);
      }

      const modeLabel = currentMode === "cli" ? `CLI (${currentCliTool})` : currentMode === "api" ? "API" : "準備中";
      addConversationEntry(ConversationEntryType.PROMPT, fullPrompt, {
        title: `提示詞 (第 ${round} 輪) - ${modeLabel}`,
        collapsed: false,
        timestamp: Date.now(),
      });

      updateConversationMode(currentMode, currentCliTool);
      addThinkingEntry(`AI 思考中 (第 ${round} 輪)...`);

      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 180000);

      let response;
      try {
        response = await fetch("/api/ai-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: timeoutController.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await response.json();
      removeThinkingEntry();

      if (data.debug) {
        addDebugEntry(data.debug, {
          title: `Debug (第 ${round} 輪)`,
          collapsed: true,
          timestamp: Date.now(),
          badge: data.debug.elapsedMs ? `${data.debug.elapsedMs}ms` : undefined,
        });
      }

      if (!data.success) {
        addConversationEntry(ConversationEntryType.ERROR, data.error || "AI 回覆失敗", {
          title: "錯誤",
          collapsed: false,
          timestamp: Date.now(),
        });
        showToast("error", "AI 回覆失敗", data.error);
        return;
      }

      updateConversationMode(data.mode, data.cliTool);

      if (data.fallbackReason) {
        showToast("warning", "模式切換", data.fallbackReason);
      }

      let badgeTools1 = data.mode === "cli" ? `CLI (${data.cliTool})` : "API";
      if (data.fallbackReason) {
        badgeTools1 = "API (fallback)";
      }

      addConversationEntry(ConversationEntryType.AI, data.reply, {
        title: `AI 回覆 (第 ${round} 輪)`,
        collapsed: false,
        timestamp: Date.now(),
        badge: badgeTools1,
      });

      const parsed = parseToolCalls(data.reply);

      if (!parsed.hasToolCalls) {
        const pinnedPromptsContent = await getPinnedPromptsContent();
        let finalReply = parsed.message || data.reply;
        if (pinnedPromptsContent) {
          finalReply = pinnedPromptsContent + "\n\n以下為我的回覆:\n" + finalReply;
        } else {
          finalReply = "以下為我的回覆:\n" + finalReply;
        }

        document.getElementById("feedbackText").value = finalReply;
        updateCharCount();

        const modeLabel = data.mode === "cli" ? `CLI (${data.cliTool})` : "API";
        showToast("success", "完成", `AI 回覆完成 (${modeLabel})`);
        return;
      }

      const toolCallsInfo = parsed.toolCalls.map(t => `${t.name}: ${JSON.stringify(t.arguments)}`).join("\n");
      addConversationEntry(ConversationEntryType.TOOL, toolCallsInfo, {
        title: `工具呼叫 (${parsed.toolCalls.length} 個)`,
        collapsed: false,
        timestamp: Date.now(),
        badge: `第 ${round} 輪`,
      });

      const results = await executeMCPTools(parsed.toolCalls);
      toolResults = formatToolResults(results);

      addConversationEntry(ConversationEntryType.RESULT, toolResults, {
        title: "工具執行結果",
        collapsed: true,
        timestamp: Date.now(),
      });

      if (round === maxToolRounds) {
        const shouldContinue = await showRound5Confirmation();
        if (!shouldContinue) {
          const pinnedPromptsContent = await getPinnedPromptsContent();
          let finalReply =
            parsed.message ||
            "AI 工具呼叫已達最大輪次，請手動完成回覆。\n\n" + toolResults;
          if (pinnedPromptsContent) {
            finalReply = pinnedPromptsContent + "\n\n以下為我的回覆:\n" + finalReply;
          } else {
            finalReply = "以下為我的回覆:\n" + finalReply;
          }
          document.getElementById("feedbackText").value = finalReply;
          updateCharCount();
          showToast("warning", "提示", "已達最大輪次，用戶選擇停止");
          return;
        }
        round = 0;
      }
    }
  } catch (error) {
    console.error("MCP AI 回覆失敗:", error);
    removeThinkingEntry();
    if (error.message !== "使用者取消操作") {
      addConversationEntry(ConversationEntryType.ERROR, error.message || "無法生成 AI 回覆", {
        title: "錯誤",
        collapsed: false,
        timestamp: Date.now(),
      });
      showToast("error", "錯誤", "無法生成 AI 回覆");
    } else {
      showToast("warning", "提示", "使用者取消操作");
    }
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
    showConversationPanel();
    updateConversationTitle("自動 AI 回覆");
    clearConversationPanel();

    try {
      const requestBody = {
        aiMessage: workSummary,
        userContext: userContext,
        projectName: getCurrentProjectName() || undefined,
        projectPath: getCurrentProjectPath() || undefined,
      };

      // 先獲取完整提示詞預覽
      let fullPrompt = buildLocalPromptPreview(workSummary, userContext, null);
      let currentMode = "pending";
      let currentCliTool = null;
      
      try {
        const previewResponse = await fetch("/api/prompt-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const previewData = await previewResponse.json();
        if (previewData.success && previewData.prompt) {
          fullPrompt = previewData.prompt;
          currentMode = previewData.mode;
          currentCliTool = previewData.cliTool;
        }
      } catch (previewError) {
        console.warn("無法獲取完整提示詞預覽，使用本地預覽:", previewError);
      }

      const modeLabel = currentMode === "cli" ? `CLI (${currentCliTool})` : currentMode === "api" ? "API" : "準備中";
      addConversationEntry(ConversationEntryType.PROMPT, fullPrompt, {
        title: `提示詞 (${modeLabel})`,
        collapsed: false,
        timestamp: Date.now(),
      });

      updateConversationMode(currentMode, currentCliTool);
      addThinkingEntry("自動 AI 回覆中...");

      const response = await fetch("/api/ai-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      removeThinkingEntry();

      if (data.debug) {
        addDebugEntry(data.debug, {
          title: "Debug 資訊 (自動回覆)",
          collapsed: true,
          timestamp: Date.now(),
          badge: data.debug.elapsedMs ? `${data.debug.elapsedMs}ms` : undefined,
        });
      }

      if (data.success) {
        updateConversationMode(data.mode, data.cliTool);

        if (data.fallbackReason) {
          showToast("warning", "模式切換", data.fallbackReason);
        }

        const pinnedPromptsContent = await getPinnedPromptsContent();
        let finalReply = data.reply;
        if (pinnedPromptsContent) {
          finalReply = pinnedPromptsContent + "\n\n以下為我的回覆:\n" + data.reply;
        } else {
          finalReply = "以下為我的回覆:\n" + data.reply;
        }

        let badgeAuto1 = data.mode === "cli" ? `CLI (${data.cliTool})` : "API";
        if (data.fallbackReason) {
          badgeAuto1 = "API (fallback)";
        }

        addConversationEntry(ConversationEntryType.AI, finalReply, {
          title: "AI 回覆",
          collapsed: false,
          timestamp: Date.now(),
          badge: badgeAuto1,
        });

        document.getElementById("feedbackText").value = finalReply;
        updateCharCount();

        if (!debugMode) hideConversationPanel();
        showAutoReplyConfirmModal(finalReply);
      } else {
        addConversationEntry(ConversationEntryType.ERROR, data.error || "AI 回覆失敗", {
          title: "錯誤",
          collapsed: false,
          timestamp: Date.now(),
        });
        showToast("error", "AI 回覆失敗", data.error);
      }
    } catch (error) {
      console.error("自動生成 AI 回覆失敗:", error);
      removeThinkingEntry();
      addConversationEntry(ConversationEntryType.ERROR, error.message || "無法自動生成 AI 回覆", {
        title: "錯誤",
        collapsed: false,
        timestamp: Date.now(),
      });
      showToast("error", "錯誤", "無法自動生成 AI 回覆");
    }
    return;
  }

  showConversationPanel();
  updateConversationTitle("自動 AI 回覆 (含工具)");
  clearConversationPanel();

  const controller = new AbortController();
  setStreamingAbortController(controller);

  let round = 0;
  let toolResults = "";
  let finalReply = "";

  try {
    while (round < maxToolRounds) {
      if (controller.signal.aborted) {
        throw new Error("使用者取消操作");
      }

      round++;

      const requestBody = {
        aiMessage: workSummary,
        userContext: userContext,
        includeMCPTools: true,
        toolResults: toolResults || undefined,
        projectName: getCurrentProjectName() || undefined,
        projectPath: getCurrentProjectPath() || undefined,
      };

      // 先獲取完整提示詞預覽
      let fullPrompt = buildLocalPromptPreview(workSummary, userContext, toolResults);
      let currentMode = "pending";
      let currentCliTool = null;
      
      try {
        const previewResponse = await fetch("/api/prompt-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const previewData = await previewResponse.json();
        if (previewData.success && previewData.prompt) {
          fullPrompt = previewData.prompt;
          currentMode = previewData.mode;
          currentCliTool = previewData.cliTool;
        }
      } catch (previewError) {
        console.warn("無法獲取完整提示詞預覽，使用本地預覽:", previewError);
      }

      const modeLabel = currentMode === "cli" ? `CLI (${currentCliTool})` : currentMode === "api" ? "API" : "準備中";
      addConversationEntry(ConversationEntryType.PROMPT, fullPrompt, {
        title: `提示詞 (第 ${round} 輪) - ${modeLabel}`,
        collapsed: false,
        timestamp: Date.now(),
      });

      updateConversationMode(currentMode, currentCliTool);
      addThinkingEntry(`自動 AI 思考中 (第 ${round} 輪)...`);

      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 180000);

      let response;
      try {
        response = await fetch("/api/ai-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: timeoutController.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await response.json();
      removeThinkingEntry();

      if (data.debug) {
        addDebugEntry(data.debug, {
          title: `Debug (自動第 ${round} 輪)`,
          collapsed: true,
          timestamp: Date.now(),
          badge: data.debug.elapsedMs ? `${data.debug.elapsedMs}ms` : undefined,
        });
      }

      if (!data.success) {
        addConversationEntry(ConversationEntryType.ERROR, data.error || "AI 回覆失敗", {
          title: "錯誤",
          collapsed: false,
          timestamp: Date.now(),
        });
        showToast("error", "AI 回覆失敗", data.error);
        return;
      }

      updateConversationMode(data.mode, data.cliTool);

      if (data.fallbackReason) {
        showToast("warning", "模式切換", data.fallbackReason);
      }

      let badgeAuto2 = data.mode === "cli" ? `CLI (${data.cliTool})` : "API";
      if (data.fallbackReason) {
        badgeAuto2 = "API (fallback)";
      }

      addConversationEntry(ConversationEntryType.AI, data.reply, {
        title: `AI 回覆 (第 ${round} 輪)`,
        collapsed: false,
        timestamp: Date.now(),
        badge: badgeAuto2,
      });

      const parsed = parseToolCalls(data.reply);

      if (!parsed.hasToolCalls) {
        finalReply = parsed.message || data.reply;
        break;
      }

      const toolCallsInfo = parsed.toolCalls.map(t => `${t.name}: ${JSON.stringify(t.arguments)}`).join("\n");
      addConversationEntry(ConversationEntryType.TOOL, toolCallsInfo, {
        title: `工具呼叫 (${parsed.toolCalls.length} 個)`,
        collapsed: false,
        timestamp: Date.now(),
        badge: `第 ${round} 輪`,
      });

      const results = await executeMCPTools(parsed.toolCalls);
      toolResults = formatToolResults(results);

      addConversationEntry(ConversationEntryType.RESULT, toolResults, {
        title: "工具執行結果",
        collapsed: true,
        timestamp: Date.now(),
      });

      if (round === maxToolRounds) {
        finalReply =
          parsed.message || "AI 工具呼叫已達最大輪次。\n\n" + toolResults;
        break;
      }
    }

    const pinnedPromptsContent = await getPinnedPromptsContent();
    if (pinnedPromptsContent) {
      finalReply = pinnedPromptsContent + "\n\n以下為我的回覆:\n" + finalReply;
    } else {
      finalReply = "以下為我的回覆:\n" + finalReply;
    }

    document.getElementById("feedbackText").value = finalReply;
    updateCharCount();

    await new Promise((r) => setTimeout(r, 1000));
    if (!debugMode) hideConversationPanel();

    showAutoReplyConfirmModal(finalReply);
  } catch (error) {
    console.error("自動生成 AI 回覆失敗:", error);
    removeThinkingEntry();
    if (error.message !== "使用者取消操作") {
      addConversationEntry(ConversationEntryType.ERROR, error.message || "無法自動生成 AI 回覆", {
        title: "錯誤",
        collapsed: false,
        timestamp: Date.now(),
      });
      showToast("error", "錯誤", "無法自動生成 AI 回覆");
    }
  } finally {
    if (!debugMode) hideConversationPanel();
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
