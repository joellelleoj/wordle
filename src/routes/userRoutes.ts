import { Router, Request, Response } from "express";

export class UserRoutes {
  private router: Router;
  private userServiceUrl: string;

  constructor() {
    this.router = Router();
    this.userServiceUrl =
      process.env.USER_SERVICE_URL || "http://localhost:3003";
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Forward all user-related requests to user service
    this.router.all("*", this.forwardToUserService);
  }

  private forwardToUserService = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const targetUrl = `${this.userServiceUrl}${req.originalUrl.replace(
        "/api/users",
        "/api"
      )}`;

      console.log(
        `Forwarding ${req.method} ${req.originalUrl} to ${targetUrl}`
      );

      // Use dynamic import for node-fetch
      const fetch = (await import("node-fetch")).default;

      // Prepare headers
      const forwardHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Copy authorization header if present
      if (req.headers.authorization) {
        forwardHeaders["Authorization"] = req.headers.authorization;
      }

      // Make request to user service
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body:
          req.method !== "GET" && req.method !== "HEAD"
            ? JSON.stringify(req.body)
            : undefined,
      });

      const data = await response.text();

      // Copy response headers (excluding problematic ones)
      response.headers.forEach((value, key) => {
        if (key !== "content-length" && key !== "transfer-encoding") {
          res.setHeader(key, value);
        }
      });

      res.status(response.status);

      // Try to parse JSON, fallback to text
      try {
        res.json(JSON.parse(data));
      } catch {
        res.send(data);
      }
    } catch (error) {
      console.error("Error forwarding to user service:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        success: false,
        message: "User service unavailable",
        error:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
    }
  };

  getRouter(): Router {
    return this.router;
  }
}

/*import { Router, Request, Response } from "express";
import fetch from "node-fetch";

export class UserRoutes {
  private router: Router;
  private userServiceUrl: string;

  constructor() {
    this.router = Router();
    this.userServiceUrl =
      process.env.USER_SERVICE_URL || "http://localhost:3003";
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Forward all user-related requests to user service
    this.router.all("*", this.forwardToUserService);
  }

  private forwardToUserService = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const targetUrl = `${this.userServiceUrl}${req.originalUrl.replace(
        "/api/users",
        "/api"
      )}`;

      console.log(
        `Forwarding ${req.method} ${req.originalUrl} to ${targetUrl}`
      );

      const forwardHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (req.headers.authorization) {
        forwardHeaders["Authorization"] = req.headers.authorization;
      }

      const response = await fetch(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body:
          req.method !== "GET" && req.method !== "HEAD"
            ? JSON.stringify(req.body)
            : undefined,
      });

      const data = await response.text();

      response.headers.forEach((value, key) => {
        if (key !== "content-length" && key !== "transfer-encoding") {
          res.setHeader(key, value);
        }
      });

      res.status(response.status);

      try {
        res.json(JSON.parse(data));
      } catch {
        res.send(data);
      }
    } catch (error) {
      console.error("Error forwarding to user service:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        success: false,
        message: "User service unavailable",
        error:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
    }
  };

  getRouter(): Router {
    return this.router;
  }
}

// routes/userRoutes.ts - Updated for new user service endpoints

import { Router } from "express";
import axios from "axios";

const router = Router();

// User service URL from environment
const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://localhost:3003";
const USER_SERVICE_API_PREFIX = "/api/v1";

// Get current user's profile
router.get("/me", async (req, res) => {
  try {
    console.log("Forwarding get my profile to user service");

    const response = await axios.get(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/users/me`,
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
    console.error("Error getting user profile:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to get user profile",
      });
    }
  }
});

// Update current user's profile
router.put("/me", async (req, res) => {
  try {
    console.log("Forwarding update my profile to user service");

    const response = await axios.put(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/users/me`,
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
    console.error("Error updating user profile:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to update user profile",
      });
    }
  }
});

// Get public user profile by ID
router.get("/profile/:id", async (req, res) => {
  try {
    console.log("Forwarding get user profile by ID to user service");

    const response = await axios.get(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/users/profile/${req.params.id}`,
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
    console.error("Error getting user profile by ID:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to get user profile",
      });
    }
  }
});

// Search users
router.get("/search", async (req, res) => {
  try {
    console.log("Forwarding user search to user service");

    const response = await axios.get(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/users/search`,
      {
        timeout: 10000,
        params: req.query,
        headers: {
          ...(req.headers.authorization && {
            Authorization: req.headers.authorization,
          }),
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Error searching users:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to search users",
      });
    }
  }
});

// Delete/deactivate current user's account
router.delete("/me", async (req, res) => {
  try {
    console.log("Forwarding account deletion to user service");

    const response = await axios.delete(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/users/me`,
      {
        timeout: 10000,
        headers: {
          ...(req.headers.authorization && {
            Authorization: req.headers.authorization,
          }),
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Error deleting user account:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to delete account",
      });
    }
  }
});

// Get user statistics (admin endpoint)
router.get("/stats", async (req, res) => {
  try {
    console.log("Forwarding user stats request to user service");

    const response = await axios.get(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/users/stats`,
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
    console.error("Error getting user stats:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to get user statistics",
      });
    }
  }
});

// User service health check
router.get("/health", async (req, res) => {
  try {
    const response = await axios.get(
      `${USER_SERVICE_URL}${USER_SERVICE_API_PREFIX}/users/health`,
      {
        timeout: 5000,
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Error checking user service health:", error.message);

    res.status(503).json({
      success: false,
      error: "User service health check failed",
    });
  }
});

export default router;
*/
