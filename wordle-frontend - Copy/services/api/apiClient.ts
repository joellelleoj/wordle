import { ApiResponse, ApiError } from "../../types/api";
import { ERROR_MESSAGES } from "../utils/constants";

interface RequestOptions {
  token?: string;
  headers?: Record<string, string>;
}

/**
 * API Client - Centralized HTTP communication with API Gateway
 *
 * SIMPLIFIED ARCHITECTURE:
 * Frontend → API Gateway → Internal Microservices
 *
 * The API Gateway handles:
 * - Request routing to appropriate microservices
 * - Load balancing and service discovery
 * - Authentication and authorization
 * - Rate limiting and caching
 * - Request/response transformation
 */
class ApiClient {
  private baseUrl: string;

  constructor() {
    // SINGLE API GATEWAY ENDPOINT
    this.baseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      "https://devstud.imn.htwk-leipzig.de/dev11";
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit & RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { token, headers = {}, ...fetchOptions } = options;

    // All requests go to the same base URL (API Gateway)
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...headers,
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new ApiError(
          data?.message || this.getErrorMessage(response.status),
          response.status,
          data
        );
      }

      return {
        success: true,
        data,
        statusCode: response.status,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Network or other errors
      throw new ApiError(ERROR_MESSAGES.NETWORK_ERROR, 0, error);
    }
  }

  private getErrorMessage(status: number): string {
    switch (status) {
      case 401:
        return ERROR_MESSAGES.UNAUTHORIZED;
      case 403:
        return ERROR_MESSAGES.FORBIDDEN;
      case 404:
        return ERROR_MESSAGES.NOT_FOUND;
      case 422:
        return ERROR_MESSAGES.VALIDATION_ERROR;
      case 500:
      default:
        return ERROR_MESSAGES.SERVER_ERROR;
    }
  }

  // HTTP methods remain the same
  async get<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(
    endpoint: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const apiClient = new ApiClient();
export { ApiError };
