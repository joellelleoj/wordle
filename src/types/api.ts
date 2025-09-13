export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ApiConfig {
  baseURL: string;
  timeout: number;
  retries: number;
}

// ============ ERROR TYPES ============
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

// ============ FORM TYPES ============
export interface FormValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface AlbumFormData {
  title: string;
  description: string;
  isPublic: boolean;
  selectedGameIds: string[];
}

// ============ UTILITY TYPES ============
export type LoadingState = "idle" | "loading" | "success" | "error";

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface SortParams {
  field: string;
  direction: "asc" | "desc";
}
