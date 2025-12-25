/**
 * Unified Navigation Bar Component
 * 可重用的導覽列組件，注入到所有頁面
 */

(function() {
    'use strict';

    const NAVBAR_HTML_PATH = '/components/navbar.html';
    
    class Navbar {
        constructor() {
            this.container = null;
            this.socket = null;
            this.currentPage = this.detectCurrentPage();
        }

        /**
         * 初始化導覽列
         */
        async init() {
            try {
                await this.loadAndInject();
                this.setupEventListeners();
                this.highlightActivePage();
                this.loadVersion();
                
                // 如果頁面有 Socket.IO，連接狀態同步
                if (window.io) {
                    this.connectSocket();
                }
            } catch (error) {
                console.error('[Navbar] Initialization failed:', error);
            }
        }

        /**
         * 載入並注入 HTML
         */
        async loadAndInject() {
            const response = await fetch(NAVBAR_HTML_PATH);
            if (!response.ok) {
                throw new Error(`Failed to load navbar: ${response.status}`);
            }
            
            const html = await response.text();
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = html;
            
            const navbar = tempContainer.querySelector('.navbar');
            if (!navbar) {
                throw new Error('Navbar element not found in HTML');
            }
            
            // 注入到 body 的最前面
            document.body.insertBefore(navbar, document.body.firstChild);
            this.container = navbar;
        }

        /**
         * 偵測當前頁面
         */
        detectCurrentPage() {
            const path = window.location.pathname;
            
            if (path === '/' || path === '/index.html') {
                return 'feedback';
            } else if (path.startsWith('/dashboard')) {
                return 'dashboard';
            } else if (path.startsWith('/mcp-settings')) {
                return 'mcp-settings';
            } else if (path.startsWith('/logs')) {
                return 'logs';
            } else if (path.startsWith('/settings')) {
                return 'settings';
            }
            
            return null;
        }

        /**
         * 高亮當前頁面連結
         */
        highlightActivePage() {
            if (!this.container || !this.currentPage) return;
            
            const links = this.container.querySelectorAll('.navbar-link');
            links.forEach(link => {
                if (link.dataset.page === this.currentPage) {
                    link.classList.add('active');
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.classList.remove('active');
                    link.removeAttribute('aria-current');
                }
            });
        }

        /**
         * 設置事件監聽器
         */
        setupEventListeners() {
            if (!this.container) return;
            
            // 移動端選單切換
            const toggle = this.container.querySelector('.navbar-toggle');
            const menu = this.container.querySelector('.navbar-menu');
            
            if (toggle && menu) {
                toggle.addEventListener('click', () => {
                    const isExpanded = menu.classList.toggle('active');
                    toggle.setAttribute('aria-expanded', String(isExpanded));
                    toggle.classList.toggle('active');
                });
            }
            
            // 點擊連結時關閉移動端選單
            const links = this.container.querySelectorAll('.navbar-link');
            links.forEach(link => {
                link.addEventListener('click', () => {
                    if (menu.classList.contains('active')) {
                        menu.classList.remove('active');
                        toggle.classList.remove('active');
                        toggle.setAttribute('aria-expanded', 'false');
                    }
                });
            });
        }

        /**
         * 載入版本資訊
         */
        async loadVersion() {
            try {
                const response = await fetch('/api/version');
                const data = await response.json();
                
                const versionEl = this.container.querySelector('#navbar-version');
                if (versionEl && data.version) {
                    versionEl.textContent = `v${data.version}`;
                }
            } catch (error) {
                console.warn('[Navbar] Failed to load version:', error);
            }
        }

        /**
         * 連接 Socket.IO 並同步狀態
         */
        connectSocket() {
            // 尋找全局的 socket 實例
            if (window.socket) {
                this.socket = window.socket;
                this.syncSocketStatus();
                return;
            }
            
            // 如果還沒有 socket，創建一個用於狀態監聽
            if (window.io) {
                this.socket = io();
                this.syncSocketStatus();
            }
        }

        /**
         * 同步 Socket.IO 連接狀態
         */
        syncSocketStatus() {
            if (!this.socket || !this.container) return;
            
            const statusEl = this.container.querySelector('#navbar-connection-status');
            if (!statusEl) return;
            
            // 更新狀態顯示
            const updateStatus = (connected) => {
                statusEl.classList.toggle('connected', connected);
                statusEl.classList.toggle('disconnected', !connected);
                
                const textEl = statusEl.querySelector('.status-text');
                if (textEl) {
                    textEl.textContent = connected ? '已連接' : '已斷開';
                }
            };
            
            // 監聽連接事件
            this.socket.on('connect', () => updateStatus(true));
            this.socket.on('disconnect', () => updateStatus(false));
            
            // 初始狀態
            updateStatus(this.socket.connected);
        }
    }

    // 頁面載入時自動初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const navbar = new Navbar();
            navbar.init();
        });
    } else {
        const navbar = new Navbar();
        navbar.init();
    }

    // 將 Navbar 暴露為全局對象（可選）
    window.Navbar = Navbar;
})();
