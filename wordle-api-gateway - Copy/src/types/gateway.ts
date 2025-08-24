export interface ProxyConfig {
  target: string;
  pathRewrite?: { [key: string]: string };
  timeout?: number;
  retries?: number;
}

export interface ServiceHealth {
  name: string;
  status: "healthy" | "unhealthy" | "unknown";
  responseTime?: number;
  lastCheck: Date;
}

export interface GatewayMetrics {
  totalRequests: number;
  activeConnections: number;
  averageResponseTime: number;
  errorRate: number;
  serviceHealths: { [serviceName: string]: ServiceHealth };
}
