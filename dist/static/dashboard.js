/**
 * Dashboard 前端邏輯
 * 負責載入和顯示專案概覽，並提供即時更新
 */

(function () {
  "use strict";

  // 配置
  const POLLING_INTERVAL = 3000; // 3秒輪詢間隔
  const API_BASE = "";

  // 狀態
  let socket = null;
  let pollTimer = null;
  let currentData = null;
  let searchFilter = "";

  // DOM 元素
  const elements = {
    connectionStatus: document.getElementById("connectionStatus"),
    versionDisplay: document.getElementById("version-display"),
    refreshBtn: document.getElementById("refreshBtn"),
    totalProjects: document.getElementById("totalProjects"),
    activeSessions: document.getElementById("activeSessions"),
    completedSessions: document.getElementById("completedSessions"),
    projectsList: document.getElementById("projectsList"),
    emptyState: document.getElementById("emptyState"),
    searchInput: document.getElementById("searchInput"),
  };

  // 初始化
  function init() {
    initSocket();
    initEventListeners();
    loadDashboardData();
    startPolling();
    loadVersion();
  }

  // 載入版本資訊
  async function loadVersion() {
    try {
      const response = await fetch(`${API_BASE}/api/version`);
      const data = await response.json();
      if (data.version) {
        elements.versionDisplay.textContent = `v${data.version}`;
      }
    } catch (error) {
      console.error("Failed to load version:", error);
    }
  }

  // 初始化 Socket.IO 連接
  function initSocket() {
    socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    socket.on("connect", () => {
      updateConnectionStatus(true);
      console.log("[Dashboard] Socket connected");
    });

    socket.on("disconnect", () => {
      updateConnectionStatus(false);
      console.log("[Dashboard] Socket disconnected");
    });

    // 監聽 Dashboard 事件
    socket.on("dashboard:session_created", (data) => {
      console.log("[Dashboard] Session created:", data);
      loadDashboardData();
    });

    socket.on("dashboard:session_updated", (data) => {
      console.log("[Dashboard] Session updated:", data);
      loadDashboardData();
    });

    socket.on("dashboard:project_activity", (data) => {
      console.log("[Dashboard] Project activity:", data);
      loadDashboardData();
    });
  }

  // 更新連接狀態顯示
  function updateConnectionStatus(connected) {
    elements.connectionStatus.classList.toggle("connected", connected);
    elements.connectionStatus.classList.toggle("disconnected", !connected);
    const statusText = elements.connectionStatus.querySelector(".status-text");
    if (statusText) {
      statusText.textContent = connected ? "已連接" : "已斷開";
    }
  }

  // 初始化事件監聽器
  function initEventListeners() {
    elements.refreshBtn.addEventListener("click", () => {
      loadDashboardData();
    });

    elements.searchInput.addEventListener("input", (e) => {
      searchFilter = e.target.value.toLowerCase();
      renderProjects();
    });
  }

  // 開始輪詢
  function startPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
    }
    pollTimer = setInterval(loadDashboardData, POLLING_INTERVAL);
  }

  // 載入 Dashboard 資料
  async function loadDashboardData() {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/overview`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      currentData = await response.json();
      updateStats();
      renderProjects();
    } catch (error) {
      console.error("[Dashboard] Failed to load data:", error);
    }
  }

  // 更新統計數據
  function updateStats() {
    if (!currentData) return;

    elements.totalProjects.textContent = currentData.totalProjects || 0;
    elements.activeSessions.textContent = currentData.totalActiveSessions || 0;

    // 計算已完成的會話數
    let completed = 0;
    if (currentData.projects) {
      currentData.projects.forEach((p) => {
        if (p.sessions) {
          completed += p.sessions.filter(
            (s) => s.status === "completed"
          ).length;
        }
      });
    }
    elements.completedSessions.textContent = completed;
  }

  // 渲染專案列表（智能DOM更新，無閃爍）
  function renderProjects() {
    if (!currentData || !currentData.projects) {
      showEmptyState();
      return;
    }

    let projects = currentData.projects;

    // 搜尋過濾
    if (searchFilter) {
      projects = projects.filter((p) => {
        const name = p.project?.name?.toLowerCase() || "";
        const path = p.project?.path?.toLowerCase() || "";
        return name.includes(searchFilter) || path.includes(searchFilter);
      });
    }

    if (projects.length === 0) {
      showEmptyState();
      return;
    }

    hideEmptyState();

    // 按活躍會話數排序
    projects.sort((a, b) => (b.activeSessions || 0) - (a.activeSessions || 0));

    // 使用智能DOM更新
    updateProjectsList(projects);
  }

  // 智能DOM更新：只更新變化的卡片，避免閃爍
  function updateProjectsList(newProjects) {
    const container = elements.projectsList;
    const existingCards = new Map();

    // 索引現有卡片
    container.querySelectorAll(".project-card").forEach((card) => {
      const projectId = card.dataset.projectId;
      existingCards.set(projectId, card);
    });

    // 建立一個臨時映射用於排序
    const newProjectsMap = new Map();
    newProjects.forEach((project, index) => {
      const projectId = String(project.project?.id || "");
      newProjectsMap.set(projectId, { project, index });
    });

    // 更新或創建卡片
    newProjects.forEach((projectData, targetIndex) => {
      const projectId = String(projectData.project?.id || "");
      const existingCard = existingCards.get(projectId);

      if (existingCard) {
        // 更新現有卡片內容
        updateProjectCard(existingCard, projectData);
        existingCards.delete(projectId);

        // 確保順序正確（如果需要移動）
        const currentIndex = Array.from(container.children).indexOf(
          existingCard
        );
        if (currentIndex !== targetIndex) {
          const referenceNode = container.children[targetIndex];
          if (referenceNode && referenceNode !== existingCard) {
            container.insertBefore(existingCard, referenceNode);
          } else if (targetIndex >= container.children.length) {
            container.appendChild(existingCard);
          }
        }
      } else {
        // 創建新卡片
        const newCard = createProjectCard(projectData);

        // 插入到正確位置
        if (targetIndex >= container.children.length) {
          container.appendChild(newCard);
        } else {
          container.insertBefore(newCard, container.children[targetIndex]);
        }

        // 添加淡入動畫
        requestAnimationFrame(() => {
          newCard.classList.add("fade-in");
        });
      }
    });

    // 移除不再存在的卡片
    existingCards.forEach((card) => {
      card.classList.add("fade-out");
      setTimeout(() => {
        if (card.parentNode === container) {
          container.removeChild(card);
        }
      }, 300);
    });
  }

  // 創建專案卡片 DOM 元素
  function createProjectCard(projectData) {
    const div = document.createElement("div");
    const projectId = String(projectData.project?.id || "");
    div.className = "project-card";
    div.dataset.projectId = projectId;

    if (projectData.activeSessions > 0) {
      div.classList.add("has-active");
    }

    // 設置內容
    div.innerHTML = renderProjectCardHTML(projectData);

    // 綁定點擊事件
    div.addEventListener("click", () => {
      navigateToSession(projectId);
    });

    // 綁定會話項點擊事件
    div.querySelectorAll(".session-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const sessionId = item.dataset.sessionId;
        navigateToSessionPage(sessionId);
      });
    });

    return div;
  }

  // 更新現有專案卡片
  function updateProjectCard(card, projectData) {
    const projectId = String(projectData.project?.id || "");
    const hasActive = projectData.activeSessions > 0;

    // 更新類別
    card.classList.toggle("has-active", hasActive);

    // 更新專案名稱
    const nameEl = card.querySelector(".project-name");
    const newName = projectData.project?.name || "Unknown";
    if (nameEl) {
      const iconSpan = nameEl.querySelector(".icon");
      const currentName = nameEl.textContent.trim().substring(2); // 移除圖標字符
      if (currentName !== newName) {
        nameEl.innerHTML = '<span class="icon">📁</span>' + escapeHtml(newName);
      }
    }

    // 更新徽章
    const badgeEl = card.querySelector(".project-badge");
    if (badgeEl) {
      const badgeClass = hasActive ? "active" : "idle";
      const badgeText = hasActive
        ? `${projectData.activeSessions} 等待中`
        : "無等待";

      badgeEl.className = `project-badge ${badgeClass}`;
      if (badgeEl.textContent !== badgeText) {
        badgeEl.textContent = badgeText;
      }
    }

    // 更新活躍會話數
    const activeStatEl = card.querySelector(
      ".project-stat.active .value, .project-stat .value"
    );
    if (activeStatEl) {
      const newValue = String(projectData.activeSessions);
      if (activeStatEl.textContent !== newValue) {
        activeStatEl.textContent = newValue;
      }
    }

    // 更新總會話數
    const stats = card.querySelectorAll(".project-stat .value");
    if (stats.length > 1) {
      const newValue = String(projectData.totalSessions);
      if (stats[1].textContent !== newValue) {
        stats[1].textContent = newValue;
      }
    }

    // 更新會話列表（簡化版：完全替換）
    const sessionsContainer = card.querySelector(".project-sessions");
    const newSessions = projectData.sessions || [];
    const displaySessions = newSessions.slice(0, 3);

    if (displaySessions.length > 0) {
      const newSessionsHTML = `
                <div class="project-sessions">
                    <div class="session-list">
                        ${displaySessions
                          .map((s) => renderSessionItem(s))
                          .join("")}
                    </div>
                </div>
            `;

      if (sessionsContainer) {
        const parent = sessionsContainer.parentNode;
        const temp = document.createElement("div");
        temp.innerHTML = newSessionsHTML;
        parent.replaceChild(temp.firstElementChild, sessionsContainer);
      } else {
        // 如果之前沒有會話，添加會話列表
        const bodyEl = card.querySelector(".project-card-body");
        if (bodyEl) {
          const temp = document.createElement("div");
          temp.innerHTML = newSessionsHTML;
          bodyEl.appendChild(temp.firstElementChild);
        }
      }

      // 重新綁定會話項點擊事件
      card.querySelectorAll(".session-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const sessionId = item.dataset.sessionId;
          navigateToSessionPage(sessionId);
        });
      });
    } else if (sessionsContainer) {
      // 移除會話列表
      sessionsContainer.remove();
    }
  }

  // 渲染專案卡片 HTML（用於創建新卡片）
  function renderProjectCardHTML(projectData) {
    const project = projectData.project || {};
    const sessions = projectData.sessions || [];
    const activeSessions = projectData.activeSessions || 0;
    const totalSessions = projectData.totalSessions || 0;

    const hasActive = activeSessions > 0;
    const badgeClass = hasActive ? "active" : "idle";
    const badgeText = hasActive ? `${activeSessions} 等待中` : "無等待";

    // 最多顯示 3 個會話
    const displaySessions = sessions.slice(0, 3);

    return `
            <div class="project-card ${
              hasActive ? "has-active" : ""
            }" data-project-id="${project.id}">
                <div class="project-card-header">
                    <div class="project-name">
                        <span class="icon">📁</span>
                        ${escapeHtml(project.name || "Unknown")}
                    </div>
                    <span class="project-badge ${badgeClass}">${badgeText}</span>
                </div>
                <div class="project-card-body">
                    ${
                      project.path
                        ? `<div class="project-path">${escapeHtml(
                            project.path
                          )}</div>`
                        : ""
                    }
                    <div class="project-stats">
                        <div class="project-stat ${hasActive ? "active" : ""}">
                            <span class="icon">⏳</span>
                            <span class="value">${activeSessions}</span>
                            <span>等待</span>
                        </div>
                        <div class="project-stat">
                            <span class="icon">📋</span>
                            <span class="value">${totalSessions}</span>
                            <span>總計</span>
                        </div>
                    </div>
                    ${
                      displaySessions.length > 0
                        ? `
                        <div class="project-sessions">
                            <div class="session-list">
                                ${displaySessions
                                  .map((s) => renderSessionItem(s))
                                  .join("")}
                            </div>
                        </div>
                    `
                        : ""
                    }
                </div>
            </div>
        `;
  }

  // 渲染會話項
  function renderSessionItem(session) {
    const status = session.status || "active";
    const statusText = getStatusText(status);
    const summary = session.workSummary || "無摘要";
    const truncatedSummary =
      summary.length > 50 ? summary.substring(0, 50) + "..." : summary;

    return `
            <div class="session-item ${status}" data-session-id="${
      session.sessionId
    }">
                <span class="session-summary">${escapeHtml(
                  truncatedSummary
                )}</span>
                <span class="session-status ${status}">${statusText}</span>
            </div>
        `;
  }

  // 獲取狀態文字
  function getStatusText(status) {
    const statusMap = {
      waiting: "等待中",
      active: "進行中",
      completed: "已完成",
      timeout: "已逾時",
    };
    return statusMap[status] || status;
  }

  // 顯示空狀態
  function showEmptyState() {
    elements.projectsList.innerHTML = "";
    elements.emptyState.style.display = "flex";
  }

  // 隱藏空狀態
  function hideEmptyState() {
    elements.emptyState.style.display = "none";
  }

  // 導航到專案的第一個活躍會話
  function navigateToSession(projectId) {
    if (!currentData) return;

    const projectData = currentData.projects.find(
      (p) => p.project?.id === projectId
    );
    if (
      !projectData ||
      !projectData.sessions ||
      projectData.sessions.length === 0
    ) {
      console.log("[Dashboard] No sessions for project:", projectId);
      return;
    }

    // 優先選擇等待中的會話
    const activeSession = projectData.sessions.find(
      (s) => s.status === "active" || s.status === "waiting"
    );
    const sessionId = activeSession
      ? activeSession.sessionId
      : projectData.sessions[0].sessionId;

    navigateToSessionPage(sessionId);
  }

  // 導航到會話頁面
  function navigateToSessionPage(sessionId) {
    // 導航到會話回饋頁面
    window.location.href = `/?sessionId=${sessionId}`;
  }

  // HTML 轉義
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // 頁面載入完成後初始化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
