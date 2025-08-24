import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { GameProvider } from "./contexts/GameContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute/ProtectedRoute";
import { Header } from "./components/layout/Header/Header";
import { Footer } from "./components/layout/Footer/Footer";
import { GamePage } from "./pages/GamePage/GamePage";
import { LoginPage } from "./pages/LoginPage/LoginPage";
import { RegisterPage } from "./pages/RegisterPage/RegisterPage";
import { ProfilePage } from "./pages/ProfilePage/ProfilePage";
import { StatisticsPage } from "./pages/StatisticsPage/StatisticsPage";
import { SearchPage } from "./pages/SearchPage/SearchPage";
import { NotFoundPage } from "./pages/NotFoundPage/NotFoundPage";
import { ToastContainer } from "./components/ui/Toast/Toast";
import { useToast } from "./hooks/useToast";
import styles from "./App.module.css";

/**
 * Main Application Component
 *
 * Implements:
 * - Microservice Architecture: Communicates only with API Gateway
 * - 12-Factor App: Stateless frontend, environment-based configuration
 * - Single Responsibility: Orchestrates routing and global state management
 * - Provider Pattern: Manages global state with React Context
 */
const AppContent: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  return (
    <div className={styles.app}>
      <Header />
      <main className={styles.main}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes - Require Authentication */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <GamePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/game"
            element={
              <ProtectedRoute>
                <GamePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile/:userId"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/statistics"
            element={
              <ProtectedRoute>
                <StatisticsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback Routes */}
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </main>
      <Footer />

      {/* Global Toast Notifications */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        position="top-right"
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <GameProvider>
            <Router>
              <AppContent />
            </Router>
          </GameProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
