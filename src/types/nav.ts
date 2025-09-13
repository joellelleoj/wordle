// types/nav.ts - Updated to use shared types from index.ts
import { User, Page } from "./index";

export interface HeaderProps {
  isAuthenticated: boolean;
  user: User | null;
  onLogout: () => void;
  onNavigate: (page: Page) => void;
  currentPage: Page;
}

// Re-export shared types for convenience
export type { User, Page } from "./index";
