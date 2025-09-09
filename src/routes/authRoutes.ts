// routes/authRoutes.ts - Fixed TypeScript errors

import { Router } from "express";
import axios from "axios";

// Type definitions for API responses
interface ApiResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

interface UserData {
  user: {
    id: string;
    email: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

const router = Router();

// User service URL from environment
const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://localhost:3003";
const USER_SERVICE_API_PREFIX = "/api/v1";

// Initiate OAuth2 login flow
router.get("/login", async (req, res) => {
  try {
    console.log("Forwarding OAuth2 login initiation to user service");

    const response = await axios.get(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/auth/login`,
      {
        timeout: 10000,
        params: req.query, // Forward query parameters (redirectUrl, etc.)
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Error forwarding OAuth2 login:", error.message);

    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      res.status(503).json({
        success: false,
        error: "User service unavailable",
      });
    } else if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        error: "Login initiation failed",
      });
    }
  }
});

// Handle OAuth2 callback (GET - for redirect flow)
router.get("/callback", async (req, res) => {
  try {
    console.log("Forwarding OAuth2 callback to user service");

    // Forward the callback to user service - this will handle the redirect
    const callbackUrl = `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/auth/callback?${new URLSearchParams(
      req.query as any
    ).toString()}`;

    // Redirect to user service callback handler
    res.redirect(callbackUrl);
  } catch (error: any) {
    console.error("Error forwarding OAuth2 callback:", error.message);
    res.redirect(
      `${
        process.env.CLIENT_URL || "http://localhost:3000"
      }/login?error=callback_failed`
    );
  }
});

// Handle OAuth2 callback (POST - for API flow)
router.post("/callback", async (req, res) => {
  try {
    console.log("Forwarding OAuth2 callback POST to user service");

    const response = await axios.post(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/auth/callback`,
      req.body,
      {
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Error forwarding OAuth2 callback POST:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        error: "OAuth2 callback failed",
      });
    }
  }
});

// Refresh JWT token
router.post("/refresh", async (req, res) => {
  try {
    console.log("Forwarding token refresh to user service");

    const response = await axios.post(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/auth/refresh`,
      req.body,
      {
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Error forwarding token refresh:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(401).json({
        success: false,
        error: "Token refresh failed",
      });
    }
  }
});

// Logout user
router.post("/logout", async (req, res) => {
  try {
    console.log("Forwarding logout to user service");

    const response = await axios.post(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/auth/logout`,
      req.body,
      {
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Error forwarding logout:", error.message);

    // Even if logout fails on service side, return success to client
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  }
});

// Logout from all devices
router.post("/logout-all", async (req, res) => {
  try {
    console.log("Forwarding logout-all to user service");

    const response = await axios.post(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/auth/logout-all`,
      req.body,
      {
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
          ...(req.headers.authorization && {
            Authorization: req.headers.authorization,
          }),
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Error forwarding logout-all:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        error: "Logout from all devices failed",
      });
    }
  }
});

// Get current user info
router.get("/me", async (req, res) => {
  try {
    console.log("Forwarding get current user to user service");

    const response = await axios.get(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/auth/me`,
      {
        timeout: 5000,
        headers: {
          ...(req.headers.authorization && {
            Authorization: req.headers.authorization,
          }),
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Error getting current user:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to get current user",
      });
    }
  }
});

// Auth service health check
router.get("/health", async (req, res) => {
  try {
    const response = await axios.get(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/auth/health`,
      {
        timeout: 5000,
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Error checking auth service health:", error.message);

    res.status(503).json({
      success: false,
      error: "Auth service health check failed",
    });
  }
});

// Legacy endpoints (for backward compatibility - these can be removed later)

// Legacy register endpoint (if you had local registration before)
router.post("/register", async (req, res) => {
  res.status(501).json({
    success: false,
    error: "Registration is now handled via OAuth2",
    message: "Please use GET /auth/login to initiate OAuth2 authentication",
  });
});

// Legacy login endpoint (for backward compatibility)
router.post("/login", async (req, res) => {
  res.status(301).json({
    success: false,
    error: "Login method changed",
    message: "Please use GET /auth/login to initiate OAuth2 authentication",
    redirect_to: "/api/auth/login",
  });
});

// Legacy verify endpoint
router.post("/verify", async (req, res) => {
  // This can redirect to the /me endpoint for token verification
  try {
    const response = await axios.get(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/auth/me`,
      {
        timeout: 5000,
        headers: {
          ...(req.headers.authorization && {
            Authorization: req.headers.authorization,
          }),
        },
      }
    );

    // Type assertion for the response data
    const responseData = response.data as ApiResponse;
    const userData = responseData.data as UserData;

    res.json({
      success: true,
      valid: true,
      user: userData.user,
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      valid: false,
      error: "Token verification failed",
    });
  }
});

// Legacy profile endpoint
router.get("/profile", async (req, res) => {
  // Redirect to /me endpoint
  try {
    const response = await axios.get(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/auth/me`,
      {
        timeout: 5000,
        headers: {
          ...(req.headers.authorization && {
            Authorization: req.headers.authorization,
          }),
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to get profile",
      });
    }
  }
});

export default router;
