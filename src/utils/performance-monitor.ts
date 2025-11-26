/**
 * user-feedback MCP Tools - 效能監控工具
 */

import { logger } from './logger.js';

/**
 * 效能指標介面
 */
export interface PerformanceMetrics {
  // 記憶體使用
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };

  // CPU使用
  cpuUsage: {
    user: number;
    system: number;
  };

  // 執行時間
  uptime: number;

  // 請求統計
  requestStats: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };

  // WebSocket連線
  websocketStats: {
    activeConnections: number;
    totalConnections: number;
    messagesReceived: number;
    messagesSent: number;
  };

  // 會話統計
  sessionStats: {
    activeSessions: number;
    totalSessions: number;
    completedSessions: number;
    timeoutSessions: number;
  };
}

/**
 * 效能監控器類別
 */
export class PerformanceMonitor {
  private startTime: number;
  private requestStats = {
    total: 0,
    successful: 0,
    failed: 0,
    responseTimes: [] as number[]
  };

  private websocketStats = {
    activeConnections: 0,
    totalConnections: 0,
    messagesReceived: 0,
    messagesSent: 0
  };

  private sessionStats = {
    activeSessions: 0,
    totalSessions: 0,
    completedSessions: 0,
    timeoutSessions: 0
  };

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * 記錄HTTP請求
   */
  recordRequest(responseTime: number, success: boolean): void {
    this.requestStats.total++;
    this.requestStats.responseTimes.push(responseTime);

    if (success) {
      this.requestStats.successful++;
    } else {
      this.requestStats.failed++;
    }

    // 保持最近1000個回應時間記錄
    if (this.requestStats.responseTimes.length > 1000) {
      this.requestStats.responseTimes = this.requestStats.responseTimes.slice(-1000);
    }
  }

  /**
   * 記錄WebSocket連線
   */
  recordWebSocketConnection(): void {
    this.websocketStats.activeConnections++;
    this.websocketStats.totalConnections++;
  }

  /**
   * 記錄WebSocket斷開連線
   */
  recordWebSocketDisconnection(): void {
    this.websocketStats.activeConnections = Math.max(0, this.websocketStats.activeConnections - 1);
  }

  /**
   * 記錄WebSocket訊息
   */
  recordWebSocketMessage(direction: 'received' | 'sent'): void {
    if (direction === 'received') {
      this.websocketStats.messagesReceived++;
    } else {
      this.websocketStats.messagesSent++;
    }
  }

  /**
   * 記錄會話建立
   */
  recordSessionCreated(): void {
    this.sessionStats.activeSessions++;
    this.sessionStats.totalSessions++;
  }

  /**
   * 記錄會話完成
   */
  recordSessionCompleted(): void {
    this.sessionStats.activeSessions = Math.max(0, this.sessionStats.activeSessions - 1);
    this.sessionStats.completedSessions++;
  }

  /**
   * 記錄會話逾時
   */
  recordSessionTimeout(): void {
    this.sessionStats.activeSessions = Math.max(0, this.sessionStats.activeSessions - 1);
    this.sessionStats.timeoutSessions++;
  }

  /**
   * 取得目前效能指標
   */
  getMetrics(): PerformanceMetrics {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: Date.now() - this.startTime,
      requestStats: {
        total: this.requestStats.total,
        successful: this.requestStats.successful,
        failed: this.requestStats.failed,
        averageResponseTime: this.calculateAverageResponseTime()
      },
      websocketStats: { ...this.websocketStats },
      sessionStats: { ...this.sessionStats }
    };
  }

  /**
   * 計算平均回應時間
   */
  private calculateAverageResponseTime(): number {
    if (this.requestStats.responseTimes.length === 0) {
      return 0;
    }

    const sum = this.requestStats.responseTimes.reduce((a, b) => a + b, 0);
    return sum / this.requestStats.responseTimes.length;
  }

  /**
   * 取得格式化的效能報告
   */
  getFormattedReport(): string {
    const metrics = this.getMetrics();

    return `
📊 效能監控報告
================

💾 記憶體使用:
  - 堆積記憶體使用: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB
  - 堆積記憶體總量: ${(metrics.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB
  - 外部記憶體: ${(metrics.memoryUsage.external / 1024 / 1024).toFixed(2)} MB
  - RSS: ${(metrics.memoryUsage.rss / 1024 / 1024).toFixed(2)} MB

⏱️ 執行時間: ${(metrics.uptime / 1000).toFixed(2)} 秒

🌐 HTTP請求統計:
  - 總請求數: ${metrics.requestStats.total}
  - 成功請求: ${metrics.requestStats.successful}
  - 失敗請求: ${metrics.requestStats.failed}
  - 平均回應時間: ${metrics.requestStats.averageResponseTime.toFixed(2)} ms

🔌 WebSocket統計:
  - 活躍連線: ${metrics.websocketStats.activeConnections}
  - 總連線數: ${metrics.websocketStats.totalConnections}
  - 接收訊息: ${metrics.websocketStats.messagesReceived}
  - 傳送訊息: ${metrics.websocketStats.messagesSent}

📋 會話統計:
  - 活躍會話: ${metrics.sessionStats.activeSessions}
  - 總會話數: ${metrics.sessionStats.totalSessions}
  - 完成會話: ${metrics.sessionStats.completedSessions}
  - 逾時會話: ${metrics.sessionStats.timeoutSessions}
`;
  }

  /**
   * 檢查效能警告
   */
  checkPerformanceWarnings(): string[] {
    const metrics = this.getMetrics();
    const warnings: string[] = [];

    // 記憶體使用警告
    const heapUsedMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
    if (heapUsedMB > 200) {
      warnings.push(`記憶體使用過高: ${heapUsedMB.toFixed(2)} MB`);
    }

    // 回應時間警告
    if (metrics.requestStats.averageResponseTime > 2000) {
      warnings.push(`平均回應時間過長: ${metrics.requestStats.averageResponseTime.toFixed(2)} ms`);
    }

    // 失敗率警告
    const failureRate = metrics.requestStats.total > 0
      ? (metrics.requestStats.failed / metrics.requestStats.total) * 100
      : 0;
    if (failureRate > 5) {
      warnings.push(`請求失敗率過高: ${failureRate.toFixed(2)}%`);
    }

    // 會話逾時警告
    const timeoutRate = metrics.sessionStats.totalSessions > 0
      ? (metrics.sessionStats.timeoutSessions / metrics.sessionStats.totalSessions) * 100
      : 0;
    if (timeoutRate > 20) {
      warnings.push(`會話逾時率過高: ${timeoutRate.toFixed(2)}%`);
    }

    return warnings;
  }

  /**
   * 啟動定期效能監控
   */
  startPeriodicMonitoring(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(() => {
      const warnings = this.checkPerformanceWarnings();

      if (warnings.length > 0) {
        logger.warn('效能警告:', warnings);
      }

      // 記錄效能指標到日誌
      const metrics = this.getMetrics();
      logger.debug('效能指標:', {
        memoryMB: (metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
        uptime: (metrics.uptime / 1000).toFixed(2),
        requests: metrics.requestStats.total,
        avgResponseTime: metrics.requestStats.averageResponseTime.toFixed(2),
        activeConnections: metrics.websocketStats.activeConnections,
        activeSessions: metrics.sessionStats.activeSessions
      });
    }, intervalMs);
  }

  /**
   * 重置統計資料
   */
  reset(): void {
    this.startTime = Date.now();
    this.requestStats = {
      total: 0,
      successful: 0,
      failed: 0,
      responseTimes: []
    };
    this.websocketStats = {
      activeConnections: 0,
      totalConnections: 0,
      messagesReceived: 0,
      messagesSent: 0
    };
    this.sessionStats = {
      activeSessions: 0,
      totalSessions: 0,
      completedSessions: 0,
      timeoutSessions: 0
    };
  }
}

// 全域效能監控實例
export const performanceMonitor = new PerformanceMonitor();
