/**
 * prompt-manager.js
 * 提示詞管理模組
 * 包含提示詞 CRUD、渲染、搜尋等功能
 */

import {
  getPrompts,
  setPrompts,
  findPromptById,
  isEditingPrompt,
  getEditingPromptId,
  setIsEditingPrompt,
  setEditingPromptId,
} from "./state-manager.js";

import {
  showToast,
  formatApiError,
  escapeHtml,
  updateCharCount,
} from "./ui-helpers.js";
import { emitUserActivity } from "./socket-manager.js";

/**
 * 載入提示詞列表
 */
export async function loadPrompts() {
  try {
    const response = await fetch("/api/prompts");
    const data = await response.json();

    if (data.success) {
      setPrompts(data.prompts);
      renderPrompts();
    }
  } catch (error) {
    console.error("載入提示詞失敗:", error);
  }
}

/**
 * 自動載入釘選提示詞
 */
export async function autoLoadPinnedPrompts() {
  try {
    const response = await fetch("/api/prompts/pinned");
    const data = await response.json();

    if (data.success && data.prompts.length > 0) {
      const content = data.prompts.map((p) => p.content).join("\n\n");
      document.getElementById("feedbackText").value = content;
      updateCharCount();

      showToast(
        "info",
        "提示詞已載入",
        `已自動載入 ${data.prompts.length} 個釘選提示詞`
      );
    }
  } catch (error) {
    console.error("自動載入釘選提示詞失敗:", error);
  }
}

/**
 * 獲取釘選提示詞內容
 * @returns {Promise<string>} - 釘選提示詞內容
 */
export async function getPinnedPromptsContent() {
  try {
    const response = await fetch("/api/prompts/pinned");
    const data = await response.json();

    if (data.success && data.prompts.length > 0) {
      return data.prompts.map((p) => p.content).join("\n\n");
    }
    return "";
  } catch (error) {
    console.error("獲取釘選提示詞失敗:", error);
    return "";
  }
}

/**
 * 渲染提示詞列表
 * @param {string} searchTerm - 搜尋關鍵字
 */
export function renderPrompts(searchTerm = "") {
  const listEl = document.getElementById("promptList");
  if (!listEl) return;

  const prompts = getPrompts();
  let filteredPrompts = prompts;

  if (searchTerm) {
    filteredPrompts = prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category &&
          p.category.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  if (filteredPrompts.length === 0) {
    listEl.innerHTML = `
      <div class="placeholder">
        <span class="icon">📋</span>
        <p>${searchTerm ? "找不到符合的提示詞" : "尚無提示詞"}</p>
        <button id="addPromptBtn" class="btn btn-secondary btn-sm" onclick="openPromptModal()">新增提示詞</button>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filteredPrompts
    .map(
      (prompt) => `
        <div class="prompt-item ${
          prompt.isPinned ? "pinned" : ""
        }" onclick="usePrompt(${prompt.id})">
          <div class="prompt-item-header">
            <div class="prompt-item-title">${escapeHtml(prompt.title)}</div>
            <div class="prompt-item-actions">
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); togglePinPrompt(${
                prompt.id
              })" title="${prompt.isPinned ? "取消釘選" : "釘選"}">
                <span class="icon">${prompt.isPinned ? "📍" : "📌"}</span>
              </button>
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); editPrompt(${
                prompt.id
              })" title="編輯">
                <span class="icon">✏️</span>
              </button>
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); deletePrompt(${
                prompt.id
              })" title="刪除">
                <span class="icon">🗑️</span>
              </button>
            </div>
          </div>
          <div class="prompt-item-content">${escapeHtml(prompt.content)}</div>
          ${
            prompt.category
              ? `
            <div class="prompt-item-footer">
              <span class="prompt-item-category">${escapeHtml(
                prompt.category
              )}</span>
            </div>
          `
              : ""
          }
        </div>
      `
    )
    .join("");
}

/**
 * 過濾提示詞
 */
export function filterPrompts() {
  const searchTerm = document.getElementById("promptSearch").value;
  renderPrompts(searchTerm);
}

/**
 * 使用提示詞
 * @param {number} id - 提示詞 ID
 */
export function usePrompt(id) {
  const prompt = findPromptById(id);
  if (!prompt) return;

  const feedbackText = document.getElementById("feedbackText");
  const currentText = feedbackText.value;

  if (currentText.trim()) {
    feedbackText.value = currentText + "\n\n" + prompt.content;
  } else {
    feedbackText.value = prompt.content;
  }

  updateCharCount();
  emitUserActivity();

  showToast("success", "提示詞已使用", `已插入「${prompt.title}」`);
}

/**
 * 切換提示詞釘選狀態
 * @param {number} id - 提示詞 ID
 */
export async function togglePinPrompt(id) {
  try {
    const response = await fetch(`/api/prompts/${id}/pin`, {
      method: "PUT",
    });

    const data = await response.json();

    if (data.success) {
      await loadPrompts();
      showToast(
        "success",
        "成功",
        data.prompt.isPinned ? "已釘選提示詞" : "已取消釘選"
      );
    } else {
      showToast("error", "錯誤", formatApiError(data));
    }
  } catch (error) {
    console.error("切換釘選狀態失敗:", error);
    showToast("error", "錯誤", "操作失敗");
  }
}

/**
 * 編輯提示詞
 * @param {number} id - 提示詞 ID
 */
export function editPrompt(id) {
  const prompt = findPromptById(id);
  if (!prompt) return;

  setIsEditingPrompt(true);
  setEditingPromptId(id);

  document.getElementById("promptModalTitle").textContent = "編輯提示詞";
  document.getElementById("promptId").value = id;
  document.getElementById("promptTitle").value = prompt.title;
  document.getElementById("promptContent").value = prompt.content;
  document.getElementById("promptCategory").value = prompt.category || "";
  document.getElementById("promptIsPinned").checked = prompt.isPinned;

  openPromptModal();
}

/**
 * 刪除提示詞
 * @param {number} id - 提示詞 ID
 */
export async function deletePrompt(id) {
  if (!confirm("確定要刪除此提示詞嗎？")) return;

  try {
    const response = await fetch(`/api/prompts/${id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (data.success) {
      await loadPrompts();
      showToast("success", "成功", "提示詞已刪除");
    } else {
      showToast("error", "錯誤", formatApiError(data));
    }
  } catch (error) {
    console.error("刪除提示詞失敗:", error);
    showToast("error", "錯誤", "刪除失敗");
  }
}

/**
 * 開啟提示詞彈窗
 */
export function openPromptModal() {
  if (!isEditingPrompt()) {
    document.getElementById("promptModalTitle").textContent = "新增提示詞";
    document.getElementById("promptForm").reset();
    document.getElementById("promptId").value = "";
  }

  document.getElementById("promptModal").classList.add("show");
}

/**
 * 關閉提示詞彈窗
 */
export function closePromptModal() {
  document.getElementById("promptModal").classList.remove("show");
  setIsEditingPrompt(false);
  setEditingPromptId(null);
}

/**
 * 儲存提示詞
 */
export async function savePrompt() {
  const title = document.getElementById("promptTitle").value.trim();
  const content = document.getElementById("promptContent").value.trim();
  const category = document.getElementById("promptCategory").value.trim();
  const isPinned = document.getElementById("promptIsPinned").checked;

  if (!title || !content) {
    showToast("error", "錯誤", "標題和內容為必填欄位");
    return;
  }

  const promptData = {
    title,
    content,
    category: category || undefined,
    isPinned,
  };

  try {
    let response;
    const editing = isEditingPrompt();
    const editingId = getEditingPromptId();

    if (editing && editingId) {
      response = await fetch(`/api/prompts/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promptData),
      });
    } else {
      response = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promptData),
      });
    }

    const data = await response.json();

    if (data.success) {
      await loadPrompts();
      closePromptModal();
      showToast("success", "成功", editing ? "提示詞已更新" : "提示詞已創建");
    } else {
      showToast("error", "錯誤", formatApiError(data));
    }
  } catch (error) {
    console.error("保存提示詞失敗:", error);
    showToast("error", "錯誤", "保存失敗");
  }
}

// 暴露到 window 供 HTML onclick 使用
window.usePrompt = usePrompt;
window.togglePinPrompt = togglePinPrompt;
window.editPrompt = editPrompt;
window.deletePrompt = deletePrompt;
window.openPromptModal = openPromptModal;

export default {
  loadPrompts,
  autoLoadPinnedPrompts,
  getPinnedPromptsContent,
  renderPrompts,
  filterPrompts,
  usePrompt,
  togglePinPrompt,
  editPrompt,
  deletePrompt,
  openPromptModal,
  closePromptModal,
  savePrompt,
};
