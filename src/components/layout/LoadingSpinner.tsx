import { memo } from "react";
import "./LoadingSpinner.css";

interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large";
  color?: "primary" | "secondary" | "white";
  message?: string;
}

const LoadingSpinner = memo<LoadingSpinnerProps>(
  ({ size = "medium", color = "primary", message }) => {
    return (
      <div className={`loadingSpinner loadingSpinner--${size}`}>
        <div className={`spinner spinner--${color}`} />
        {message && <div className="message">{message}</div>}
      </div>
    );
  }
);

export { LoadingSpinner };
