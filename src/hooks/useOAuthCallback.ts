// hooks/useOAuthCallback.ts - FIXED: More robust OAuth callback handling
import { useEffect, useRef } from "react";
import { logger } from "../utils/logger";

/**
 * OAuth Callback Hook
 *
 * FIXED: Prevents multiple processing of the same callback
 * Handles OAuth callback flow when user returns from GitLab
 * Separates OAuth logic from main App component
 */
export function useOAuthCallback(
  handleOAuthCallback: (
    code: string,
    state?: string
  ) => Promise<{ success: boolean; message?: string }>
) {
  const processedRef = useRef(false);

  useEffect(() => {
    const processOAuthCallback = async () => {
      // Prevent multiple processing
      if (processedRef.current) {
        logger.debug("OAuth callback already processed, skipping");
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const state = urlParams.get("state");
      const error = urlParams.get("error");

      // Handle OAuth error
      if (error) {
        logger.error("OAuth error received", { error });
        processedRef.current = true;

        // Clean up URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
        return;
      }

      // Handle OAuth success callback
      if (code) {
        logger.info("Processing OAuth callback", {
          hasCode: true,
          hasState: !!state,
        });

        processedRef.current = true;

        try {
          const result = await handleOAuthCallback(code, state || undefined);

          if (result.success) {
            logger.info("OAuth callback processed successfully");
          } else {
            logger.error("OAuth callback failed", { message: result.message });
          }
        } catch (error) {
          logger.error("OAuth callback processing error", { error });
        } finally {
          // Clean up URL regardless of success/failure
          // Use a small delay to ensure state updates are processed
          setTimeout(() => {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
          }, 100);
        }
      }
    };

    processOAuthCallback();
  }, [handleOAuthCallback]);

  // Reset the processed flag when the component unmounts or callback changes
  useEffect(() => {
    return () => {
      processedRef.current = false;
    };
  }, [handleOAuthCallback]);
}
