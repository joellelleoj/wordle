import { useCallback } from "react";

/**
 * Vibration Hook - Handles device vibration feedback
 *
 * Provides tactile feedback for game interactions
 */
export const useVibration = () => {
  const vibrate = useCallback((pattern: number | number[]) => {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (err) {
        console.warn("Vibration not supported or failed:", err);
      }
    }
  }, []);

  const isSupported = "vibrate" in navigator;

  return { vibrate, isSupported };
};
