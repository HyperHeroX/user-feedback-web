/**
 * mcp-manager.js
 * MCP Servers 管理模組
 */

import {
  getMcpServers,
  setMcpServers,
  getEditingMcpServerId,
  setEditingMcpServerId,
  findMcpServerById,
} from "./state-manager.js";

import {
  showToast,
  showLoadingOverlay,
  hideLoadingOverlay,
  escapeHtml,
} from "./ui-helpers.js";

/**
 * 載入 MCP Servers
 */
export async function loadMCPServers() {
  try {
    const response = await fetch("/api/mcp-servers");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.success) {
      setMcpServers(data.servers || []);
      renderMCPServerList();
    }
  } catch (error) {
    console.error("載入 MCP Servers 失敗:", error);
    showToast("error", "錯誤", "載入 MCP Servers 失敗");
  }
}

/**
 * 渲染 MCP Server 列表
 */
export function renderMCPServerList() {
  const container = document.getElementById("mcpServerList");
  const mcpServers = getMcpServers();

  if (!mcpServers || mcpServers.length === 0) {
    container.innerHTML = `
      <div class="placeholder">
        <span class="icon">🔌</span>
        <p>尚無 MCP Server</p>
      </div>
    `;
    return;
  }

  container.innerHTML = mcpServers
    .map((server) => {
      const state = server.state || { status: "disconnected", tools: [] };
      const toolsCount = state.tools?.length || 0;
      const statusText = getStatusText(state.status);

      return `
      <div class="mcp-server-item" data-id="${server.id}">
        <div class="mcp-server-status ${
          state.status
        }" title="${statusText}"></div>
        <div class="mcp-server-info">
          <div class="mcp-server-name">${escapeHtml(server.name)}</div>
          <div class="mcp-server-details">
            <span class="mcp-server-transport">${server.transport}</span>
            ${
              state.status === "connected"
                ? `<span class="mcp-server-tools-count">${toolsCount} 工具</span>`
                : ""
            }
            ${
              !server.enabled
                ? '<span style="color: var(--text-muted)">已停用</span>'
                : ""
            }
          </div>
          ${
            state.error
              ? `<div class="mcp-server-error">錯誤: ${escapeHtml(
                  state.error
                )}</div>`
              : ""
          }
          ${
            state.status === "connected" && toolsCount > 0
              ? renderToolsList(state.tools)
              : ""
          }
        </div>
        <div class="mcp-server-actions">
          ${
            state.status === "connected"
              ? `<button class="btn btn-ghost btn-disconnect" onclick="disconnectMCPServer(${server.id})" title="斷開">🔌</button>`
              : `<button class="btn btn-ghost btn-connect" onclick="connectMCPServer(${
                  server.id
                })" title="連接" ${
                  !server.enabled ? "disabled" : ""
                }>🔗</button>`
          }
          <button class="btn btn-ghost btn-edit" onclick="editMCPServer(${
            server.id
          })" title="編輯">✏️</button>
          <button class="btn btn-ghost btn-delete" onclick="deleteMCPServerConfirm(${
            server.id
          })" title="刪除">🗑️</button>
        </div>
      </div>
    `;
    })
    .join("");
}

/**
 * 渲染工具列表
 */
function renderToolsList(tools) {
  if (!tools || tools.length === 0) return "";

  const displayTools = tools.slice(0, 5);
  const remaining = tools.length - 5;

  return `
    <div class="mcp-tools-list">
      ${displayTools
        .map(
          (tool) => `
        <div class="mcp-tool-item">
          <span class="mcp-tool-name">${escapeHtml(tool.name)}</span>
          <span class="mcp-tool-desc">${escapeHtml(
            tool.description || ""
          )}</span>
        </div>
      `
        )
        .join("")}
      ${
        remaining > 0
          ? `<div class="mcp-tool-item" style="color: var(--text-muted)">...還有 ${remaining} 個工具</div>`
          : ""
      }
    </div>
  `;
}

/**
 * 取得狀態文字
 */
function getStatusText(status) {
  const texts = {
    disconnected: "未連接",
    connecting: "連接中...",
    connected: "已連接",
    error: "連接錯誤",
  };
  return texts[status] || status;
}

/**
 * 開啟 MCP Servers 彈窗
 */
export function openMCPServersModal() {
  document.getElementById("mcpServersModal").classList.add("show");
  loadMCPServers();
}

/**
 * 關閉 MCP Servers 彈窗
 */
export function closeMCPServersModal() {
  document.getElementById("mcpServersModal").classList.remove("show");
}

/**
 * 開啟 MCP Server 編輯彈窗
 */
export function openMCPServerEditModal(server = null) {
  setEditingMcpServerId(server?.id || null);

  document.getElementById("mcpServerEditTitle").textContent = server
    ? "編輯 MCP Server"
    : "新增 MCP Server";
  document.getElementById("mcpServerId").value = server?.id || "";
  document.getElementById("mcpServerName").value = server?.name || "";
  document.getElementById("mcpServerTransport").value =
    server?.transport || "stdio";
  document.getElementById("mcpServerCommand").value = server?.command || "";
  document.getElementById("mcpServerArgs").value = (server?.args || []).join(
    "\n"
  );
  document.getElementById("mcpServerEnv").value = server?.env
    ? Object.entries(server.env)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n")
    : "";
  document.getElementById("mcpServerUrl").value = server?.url || "";
  document.getElementById("mcpServerEnabled").checked =
    server?.enabled !== false;

  onTransportChange();
  document.getElementById("mcpServerEditModal").classList.add("show");
}

/**
 * 關閉 MCP Server 編輯彈窗
 */
export function closeMCPServerEditModal() {
  document.getElementById("mcpServerEditModal").classList.remove("show");
  setEditingMcpServerId(null);
}

/**
 * 傳輸方式變更處理
 */
export function onTransportChange() {
  const transport = document.getElementById("mcpServerTransport").value;
  const stdioSettings = document.getElementById("stdioSettings");
  const httpSettings = document.getElementById("httpSettings");

  if (transport === "stdio") {
    stdioSettings.style.display = "block";
    httpSettings.style.display = "none";
  } else {
    stdioSettings.style.display = "none";
    httpSettings.style.display = "block";
  }
}

/**
 * 儲存 MCP Server
 */
export async function saveMCPServer() {
  const id = document.getElementById("mcpServerId").value;
  const name = document.getElementById("mcpServerName").value.trim();
  const transport = document.getElementById("mcpServerTransport").value;
  const command = document.getElementById("mcpServerCommand").value.trim();
  const argsText = document.getElementById("mcpServerArgs").value.trim();
  const envText = document.getElementById("mcpServerEnv").value.trim();
  const url = document.getElementById("mcpServerUrl").value.trim();
  const enabled = document.getElementById("mcpServerEnabled").checked;

  if (!name) {
    showToast("error", "錯誤", "請輸入名稱");
    return;
  }

  if (transport === "stdio" && !command) {
    showToast("error", "錯誤", "stdio 傳輸方式需要指定命令");
    return;
  }

  if ((transport === "sse" || transport === "streamable-http") && !url) {
    showToast("error", "錯誤", `${transport} 傳輸方式需要指定 URL`);
    return;
  }

  const args = argsText
    ? argsText.split("\n").filter((a) => a.trim())
    : undefined;
  const env = envText
    ? Object.fromEntries(
        envText
          .split("\n")
          .filter((line) => line.includes("="))
          .map((line) => {
            const idx = line.indexOf("=");
            return [
              line.substring(0, idx).trim(),
              line.substring(idx + 1).trim(),
            ];
          })
      )
    : undefined;

  const data = {
    name,
    transport,
    command: transport === "stdio" ? command : undefined,
    args: transport === "stdio" ? args : undefined,
    env: transport === "stdio" ? env : undefined,
    url: transport !== "stdio" ? url : undefined,
    enabled,
  };

  try {
    showLoadingOverlay("儲存中...");

    const response = await fetch(
      id ? `/api/mcp-servers/${id}` : "/api/mcp-servers",
      {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    if (result.success) {
      showToast(
        "success",
        "成功",
        id ? "MCP Server 已更新" : "MCP Server 已建立"
      );
      closeMCPServerEditModal();
      await loadMCPServers();
    } else {
      throw new Error(result.error || "儲存失敗");
    }
  } catch (error) {
    console.error("儲存 MCP Server 失敗:", error);
    showToast("error", "錯誤", error.message);
  } finally {
    hideLoadingOverlay();
  }
}

/**
 * 連接 MCP Server
 */
export async function connectMCPServer(id) {
  try {
    showLoadingOverlay("連接中...");
    const response = await fetch(`/api/mcp-servers/${id}/connect`, {
      method: "POST",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    if (result.success) {
      showToast("success", "成功", "MCP Server 已連接");
    } else {
      showToast("warning", "連接失敗", result.state?.error || "未知錯誤");
    }
    await loadMCPServers();
  } catch (error) {
    console.error("連接 MCP Server 失敗:", error);
    showToast("error", "錯誤", error.message);
  } finally {
    hideLoadingOverlay();
  }
}

/**
 * 斷開 MCP Server
 */
export async function disconnectMCPServer(id) {
  try {
    showLoadingOverlay("斷開中...");
    const response = await fetch(`/api/mcp-servers/${id}/disconnect`, {
      method: "POST",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showToast("success", "成功", "MCP Server 已斷開");
    await loadMCPServers();
  } catch (error) {
    console.error("斷開 MCP Server 失敗:", error);
    showToast("error", "錯誤", error.message);
  } finally {
    hideLoadingOverlay();
  }
}

/**
 * 編輯 MCP Server
 */
export function editMCPServer(id) {
  const server = findMcpServerById(id);
  if (server) {
    openMCPServerEditModal(server);
  }
}

/**
 * 刪除 MCP Server 確認
 */
export async function deleteMCPServerConfirm(id) {
  const server = findMcpServerById(id);
  if (!server) return;

  if (!confirm(`確定要刪除 MCP Server "${server.name}" 嗎？此操作無法復原。`)) {
    return;
  }

  try {
    showLoadingOverlay("刪除中...");
    const response = await fetch(`/api/mcp-servers/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showToast("success", "成功", "MCP Server 已刪除");
    await loadMCPServers();
  } catch (error) {
    console.error("刪除 MCP Server 失敗:", error);
    showToast("error", "錯誤", error.message);
  } finally {
    hideLoadingOverlay();
  }
}

/**
 * 連接所有 MCP Servers
 */
export async function connectAllMCPServers() {
  try {
    showLoadingOverlay("連接所有 MCP Servers...");
    const response = await fetch("/api/mcp-servers/connect-all", {
      method: "POST",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    if (result.success) {
      const succeeded = result.results.filter((r) => r.success).length;
      const total = result.results.length;
      showToast(
        "success",
        "完成",
        `已連接 ${succeeded}/${total} 個 MCP Servers`
      );
    }
    await loadMCPServers();
  } catch (error) {
    console.error("連接所有 MCP Servers 失敗:", error);
    showToast("error", "錯誤", error.message);
  } finally {
    hideLoadingOverlay();
  }
}

/**
 * 斷開所有 MCP Servers
 */
export async function disconnectAllMCPServers() {
  try {
    showLoadingOverlay("斷開所有 MCP Servers...");
    const response = await fetch("/api/mcp-servers/disconnect-all", {
      method: "POST",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showToast("success", "成功", "已斷開所有 MCP Servers");
    await loadMCPServers();
  } catch (error) {
    console.error("斷開所有 MCP Servers 失敗:", error);
    showToast("error", "錯誤", error.message);
  } finally {
    hideLoadingOverlay();
  }
}

export default {
  loadMCPServers,
  renderMCPServerList,
  openMCPServersModal,
  closeMCPServersModal,
  openMCPServerEditModal,
  closeMCPServerEditModal,
  onTransportChange,
  saveMCPServer,
  connectMCPServer,
  disconnectMCPServer,
  editMCPServer,
  deleteMCPServerConfirm,
  connectAllMCPServers,
  disconnectAllMCPServers,
};
