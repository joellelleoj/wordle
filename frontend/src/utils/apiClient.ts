/**
 * API Client Utility
 *
 * Centralized HTTP client with JWT token management.
 * Handles authentication, error responses, and request/response formatting.
 */

import { logger } from "./logger";

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

// Get API base URL based on environment
const getApiBaseUrl = (): string => {
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost"
  ) {
    // Production - use relative paths that work with reverse proxy
    return "/dev11/api";
  }
  return "http://localhost:8002/api"; // Development - API Gateway port
};

class ApiClient {
  private readonly baseURL: string;

  constructor() {
    this.baseURL = getApiBaseUrl();
  }

  /**
   * Get authentication headers with JWT token
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Get token from localStorage
    const token = localStorage.getItem("wordle_access_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Handle API response and errors
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    let responseData: any;

    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        // Handle non-JSON responses
        const text = await response.text();
        responseData = { message: text || `HTTP ${response.status}` };
      }
    } catch (parseError) {
      logger.error("Failed to parse response", { parseError });
      responseData = { message: "Invalid response format" };
    }

    if (!response.ok) {
      // Handle authentication errors
      if (response.status === 401) {
        logger.warn("Authentication required or token expired");
        // Clear invalid tokens
        localStorage.removeItem("wordle_access_token");
        localStorage.removeItem("wordle_refresh_token");
        localStorage.removeItem("wordle_user");

        return {
          success: false,
          message: "Authentication required. Please log in again.",
        };
      }

      // Handle validation errors (400)
      if (response.status === 400) {
        return {
          success: false,
          message: responseData?.message || "Invalid request data",
        };
      }

      // Handle server errors
      if (response.status >= 500) {
        return {
          success: false,
          message: "Server error. Please try again later.",
        };
      }

      // Handle other HTTP errors
      const errorMessage =
        responseData?.message ||
        responseData?.error ||
        `HTTP ${response.status}: ${response.statusText}`;

      logger.error("API request failed", {
        status: response.status,
        message: errorMessage,
        url: response.url,
      });

      return {
        success: false,
        message: errorMessage,
      };
    }

    // Success response - handle different response formats
    if (responseData && typeof responseData === "object") {
      // If already in ApiResponse format
      if ("success" in responseData) {
        return responseData;
      }

      // If it has a data field, use it
      if ("data" in responseData) {
        return {
          success: true,
          data: responseData.data,
          message: responseData.message,
        };
      }
    }

    // Default success response
    return {
      success: true,
      data: responseData,
    };
  }

  /**
   * Make HTTP request with error handling and retry logic
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    try {
      logger.debug("API request", {
        method: config.method || "GET",
        url,
        hasAuth: !!localStorage.getItem("wordle_access_token"),
      });

      const response = await fetch(url, config);
      return await this.handleResponse<T>(response);
    } catch (error) {
      logger.error("Network error", { url, error });

      // Check if it's a network connectivity issue
      if (error instanceof TypeError && error.message.includes("fetch")) {
        return {
          success: false,
          message: "Network error. Please check your connection and try again.",
        };
      }

      return {
        success: false,
        message: "Request failed. Please try again.",
      };
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
/*import { ApiResponse } from "../types";
import { logger } from "./logger";

class ApiClient {
  private readonly baseURL: string;

  constructor() {
    // Determine API URL based on environment
    this.baseURL = this.getApiUrl();
  }

  private getApiUrl(): string {
    if (
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost"
    ) {
      // Production environment - use relative paths
      return "/dev11/api"; // Based on your reverse proxy config
    }
    // Development environment
    return "http://localhost:8002/api"; // API Gateway port
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("wordle_access_token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>("GET", endpoint);
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>("POST", endpoint, data);
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", endpoint, data);
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", endpoint);
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    try {
      logger.debug(`${method} ${url}`, { data });

      const response = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: data ? JSON.stringify(data) : undefined,
      });

      // Handle different response types
      const contentType = response.headers.get("content-type");
      let responseData: any;

      if (contentType?.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Check if response was successful
      if (!response.ok) {
        logger.error(`API request failed: ${method} ${url}`, {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
        });

        // Handle authentication errors
        if (response.status === 401) {
          // Clear potentially invalid tokens
          localStorage.removeItem("wordle_access_token");
          localStorage.removeItem("wordle_refresh_token");
          localStorage.removeItem("wordle_user");
        }

        // Return error response in expected format
        return {
          success: false,
          message:
            responseData?.message ||
            `HTTP ${response.status}: ${response.statusText}`,
          error: responseData?.error || response.statusText,
        };
      }

      // Handle successful response
      logger.debug(`API request successful: ${method} ${url}`, {
        response: responseData,
      });

      // If response is already in ApiResponse format, return it
      if (
        typeof responseData === "object" &&
        responseData !== null &&
        "success" in responseData
      ) {
        return responseData as ApiResponse<T>;
      }

      // Otherwise, wrap in ApiResponse format
      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      logger.error(`Network error: ${method} ${url}`, { error });

      return {
        success: false,
        message: "Network error. Please check your connection and try again.",
        error: error instanceof Error ? error.message : "Unknown network error",
      };
    }
  }
}

export const apiClient = new ApiClient();
*/
