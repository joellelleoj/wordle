import axios, { AxiosInstance, AxiosResponse } from "axios";

interface GameServiceConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

export class GameServiceProxy {
  private client: AxiosInstance;
  private config: GameServiceConfig;

  constructor(config: GameServiceConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Wordle-API-Gateway/1.0",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - add logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(
          `🎮 Game Service Request: ${config.method?.toUpperCase()} ${
            config.url
          }`
        );
        return config;
      },
      (error) => {
        console.error("🎮 Game Service Request Error:", error);
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle errors and retries
    this.client.interceptors.response.use(
      (response) => {
        console.log(
          `🎮 Game Service Response: ${response.status} ${response.config.url}`
        );
        return response;
      },
      async (error) => {
        const config = error.config;

        if (!config._retryCount) {
          config._retryCount = 0;
        }

        // Retry logic for network errors or 5xx errors
        if (
          config._retryCount < this.config.retries &&
          (error.code === "ECONNREFUSED" ||
            error.code === "ECONNRESET" ||
            (error.response && error.response.status >= 500))
        ) {
          config._retryCount++;
          console.warn(
            `🔄 Retrying Game Service request (${config._retryCount}/${this.config.retries})`
          );

          // Exponential backoff
          const delay = Math.pow(2, config._retryCount) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));

          return this.client.request(config);
        }

        console.error("🎮 Game Service Response Error:", error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Forward authenticated request to game service
   */
  async forwardRequest(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<AxiosResponse> {
    try {
      const response = await this.client.request({
        method,
        url: path,
        data,
        headers: {
          ...headers,
          // Forward authentication header
          ...(headers?.authorization && {
            Authorization: headers.authorization,
          }),
        },
      });

      return response;
    } catch (error: any) {
      // Transform axios errors to gateway-friendly format
      if (error.response) {
        throw {
          status: error.response.status,
          message: error.response.data?.error || "Game service error",
          data: error.response.data,
        };
      } else if (error.code === "ECONNREFUSED") {
        throw {
          status: 503,
          message: "Game service unavailable",
          data: { error: "Service temporarily unavailable" },
        };
      } else {
        throw {
          status: 500,
          message: "Game service communication error",
          data: { error: "Internal server error" },
        };
      }
    }
  }

  /**
   * Health check for game service
   */
  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    try {
      const response = await this.client.get("/health", {
        timeout: 5000, // Shorter timeout for health checks
      });

      return {
        healthy: response.status === 200,
        details: response.data,
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: "Health check failed" },
      };
    }
  }
}
