import { memo } from "react";
import { Button } from "../layout/Button";
import "./OAuthSection.css";

interface OAuthSectionProps {
  onOAuthLogin: () => void;
  loading?: boolean;
}

/**
 * OAuthSection Component
 *
 * Handles OAuth2 authentication with GitLab.
 * Provides visual separation between OAuth and form auth.
 */
export const OAuthSection = memo(
  ({ onOAuthLogin, loading = false }: OAuthSectionProps) => {
    return (
      <div className="oauth-section">
        <Button
          onClick={onOAuthLogin}
          className="oauth-button"
          type="button"
          disabled={loading}
          loading={loading}
          fullWidth
        >
          <div className="oauth-button-content">
            <svg
              className="oauth-icon"
              viewBox="0 0 24 24"
              width="20"
              height="20"
            >
              <path
                fill="currentColor"
                d="M12 0L1.75 4.82L3 19.24L12 24L21 19.24L22.25 4.82L12 0ZM12 2.13L19.97 5.97L18.89 18.76L12 21.87L5.11 18.76L4.03 5.97L12 2.13Z"
              />
            </svg>
            {loading ? "Connecting..." : "Continue with GitLab"}
          </div>
        </Button>

        <div className="oauth-divider">
          <span>or continue with</span>
        </div>
      </div>
    );
  }
);

OAuthSection.displayName = "OAuthSection";
