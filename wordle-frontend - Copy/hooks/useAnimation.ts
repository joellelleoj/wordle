import { useState, useCallback, useRef } from "react";

interface UseAnimationOptions {
  duration?: number;
  onComplete?: () => void;
}

/**
 * useAnimation Hook
 *
 * Provides utilities for managing component animations
 */
export const useAnimation = (options: UseAnimationOptions = {}) => {
  const { duration = 300, onComplete } = options;
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const trigger = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsAnimating(true);

    timeoutRef.current = setTimeout(() => {
      setIsAnimating(false);
      onComplete?.();
    }, duration);
  }, [duration, onComplete]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsAnimating(false);
  }, []);

  return {
    isAnimating,
    trigger,
    cancel,
  };
};
