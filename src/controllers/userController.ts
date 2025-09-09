/*// src/controllers/userController.ts - CORRECTED VERSION

import { Request, Response } from "express";
import DataAccessService from "../services/dataAccessService";
import { ApiResponse, UpdateUserData } from "../types/user.types";

export class UserController {
  private dataAccessService: DataAccessService;

  constructor() {
    this.dataAccessService = new DataAccessService();
  }

  // GET /users/profile/:id - Get user profile by ID
  getUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: "User ID is required",
        };
        res.status(400).json(response);
        return;
      }

      const user = await this.dataAccessService.getUserById(id);

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: "User not found",
        };
        res.status(404).json(response);
        return;
      }

      // Return only public user information
      const publicProfile = {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      };

      const response: ApiResponse = {
        success: true,
        data: { user: publicProfile },
        message: "User profile retrieved successfully",
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error("Get user profile error:", error);

      const response: ApiResponse = {
        success: false,
        error: "Failed to retrieve user profile",
        message: error.message,
      };

      res.status(500).json(response);
    }
  };

  // GET /users/me - Get current user's complete profile
  getMyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: "Authentication required",
        };
        res.status(401).json(response);
        return;
      }

      const user = await this.dataAccessService.getUserById(req.user.sub);

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: "User not found",
        };
        res.status(404).json(response);
        return;
      }

      // Return complete user information (minus sensitive data)
      const { password_hash, ...userProfile } = user as any;

      const response: ApiResponse = {
        success: true,
        data: { user: userProfile },
        message: "User profile retrieved successfully",
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error("Get my profile error:", error);

      const response: ApiResponse = {
        success: false,
        error: "Failed to retrieve user profile",
        message: error.message,
      };

      res.status(500).json(response);
    }
  };

  // PUT /users/me - Update current user's profile
  updateMyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: "Authentication required",
        };
        res.status(401).json(response);
        return;
      }

      const { username, display_name } = req.body;

      // Validate input
      if (!username && !display_name) {
        const response: ApiResponse = {
          success: false,
          error: "At least one field (username or display_name) is required",
        };
        res.status(400).json(response);
        return;
      }

      // Check if username is already taken (if provided)
      if (username) {
        const existingUser = await this.dataAccessService.getUserByUsername(
          username
        );
        if (existingUser && existingUser.id !== req.user.sub) {
          const response: ApiResponse = {
            success: false,
            error: "Username is already taken",
          };
          res.status(409).json(response);
          return;
        }
      }

      const updateData: UpdateUserData = {};
      if (username) updateData.username = username;
      if (display_name) updateData.display_name = display_name;

      const updatedUser = await this.dataAccessService.updateUser(
        req.user.sub,
        updateData
      );

      if (!updatedUser) {
        const response: ApiResponse = {
          success: false,
          error: "Failed to update user profile",
        };
        res.status(500).json(response);
        return;
      }

      // Return updated user information (minus sensitive data)
      const { password_hash, ...userProfile } = updatedUser as any;

      const response: ApiResponse = {
        success: true,
        data: { user: userProfile },
        message: "User profile updated successfully",
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error("Update my profile error:", error);

      const response: ApiResponse = {
        success: false,
        error: "Failed to update user profile",
        message: error.message,
      };

      res.status(500).json(response);
    }
  };

  // GET /users/search - Search users by username, display name, or email
  searchUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { q, limit = 10 } = req.query;

      if (!q || typeof q !== "string") {
        const response: ApiResponse = {
          success: false,
          error: "Search query (q) is required",
        };
        res.status(400).json(response);
        return;
      }

      if (q.length < 2) {
        const response: ApiResponse = {
          success: false,
          error: "Search query must be at least 2 characters long",
        };
        res.status(400).json(response);
        return;
      }

      const searchLimit = Math.min(parseInt(limit as string) || 10, 50);
      const users = await this.dataAccessService.searchUsers(q, searchLimit);

      // Return only public information for search results
      const publicUsers = users.map((user) => ({
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      }));

      const response: ApiResponse = {
        success: true,
        data: {
          users: publicUsers,
          query: q,
          count: publicUsers.length,
        },
        message: "Users found successfully",
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error("Search users error:", error);

      const response: ApiResponse = {
        success: false,
        error: "Failed to search users",
        message: error.message,
      };

      res.status(500).json(response);
    }
  };

  // DELETE /users/me - Delete/deactivate current user's account
  deleteMyAccount = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: "Authentication required",
        };
        res.status(401).json(response);
        return;
      }

      // Deactivate user instead of hard delete (better for data integrity)
      await this.dataAccessService.deactivateUser(req.user.sub);

      // Revoke all refresh tokens for this user
      await this.dataAccessService.revokeAllUserRefreshTokens(req.user.sub);

      const response: ApiResponse = {
        success: true,
        message: "Account deactivated successfully",
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error("Delete account error:", error);

      const response: ApiResponse = {
        success: false,
        error: "Failed to deactivate account",
        message: error.message,
      };

      res.status(500).json(response);
    }
  };

  // GET /users/stats - Get user statistics (admin endpoint - could be protected later)
  getUserStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.dataAccessService.getUserStats();

      const response: ApiResponse = {
        success: true,
        data: { stats },
        message: "User statistics retrieved successfully",
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error("Get user stats error:", error);

      const response: ApiResponse = {
        success: false,
        error: "Failed to retrieve user statistics",
        message: error.message,
      };

      res.status(500).json(response);
    }
  };

  // GET /users/health - Health check for user service
  healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const dbHealthy = await this.dataAccessService.healthCheck();

      const response: ApiResponse = {
        success: true,
        data: {
          status: dbHealthy ? "healthy" : "degraded",
          timestamp: new Date().toISOString(),
          service: "user-service",
          database: dbHealthy ? "connected" : "disconnected",
        },
        message: "User service health check completed",
      };

      res.status(dbHealthy ? 200 : 503).json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        error: "Health check failed",
        message: error.message,
      };

      res.status(503).json(response);
    }
  };
}

export default UserController;
*/
