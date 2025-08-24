import { useState, useCallback } from "react";
import { ApiError } from "../services/api/apiClient";

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

/**
 * Generic API hook for handling async operations
 *
 * Provides consistent state management for API calls
 */
export const useApi = <T = any>(
  apiFunction: (...args: any[]) => Promise<T>,
  options: UseApiOptions = {}
) => {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: any[]) => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const data = await apiFunction(...args);
        setState({
          data,
          isLoading: false,
          error: null,
        });

        options.onSuccess?.(data);
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof ApiError
            ? err.message
            : "An unexpected error occurred";

        setState({
          data: null,
          isLoading: false,
          error: errorMessage,
        });

        options.onError?.(errorMessage);
        throw err;
      }
    },
    [apiFunction, options]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
};
