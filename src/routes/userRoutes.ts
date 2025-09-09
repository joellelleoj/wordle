// src/routes/userRoutes.ts

import { Router } from "express";
import { body, query, param } from "express-validator";
import UserController from "../controllers/UserController";
import AuthMiddleware from "../middleware/authMiddleware";

export class UserRoutes {
  private router: Router;
  private userController: UserController;
  private authMiddleware: AuthMiddleware;

  constructor() {
    this.router = Router();
    this.userController = new UserController();
    this.authMiddleware = new AuthMiddleware();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Public routes (no authentication required)

    // GET /users/health - Health check
    this.router.get("/health", this.userController.healthCheck);

    // GET /users/stats - Get user statistics
    this.router.get("/stats", this.userController.getUserStats);

    // GET /users/profile/:id - Get public user profile by ID
    this.router.get(
      "/profile/:id",
      [param("id").isUUID().withMessage("Invalid user ID format")],
      this.validateRequest,
      this.userController.getUserProfile
    );

    // GET /users/search - Search users (optionally authenticated for enhanced results)
    this.router.get(
      "/search",
      [
        query("q")
          .isLength({ min: 2 })
          .withMessage("Search query must be at least 2 characters long")
          .trim()
          .escape(),
        query("limit")
          .optional()
          .isInt({ min: 1, max: 50 })
          .withMessage("Limit must be between 1 and 50"),
      ],
      this.validateRequest,
      this.authMiddleware.optionalAuthenticate,
      this.userController.searchUsers
    );

    // Protected routes (authentication required)

    // GET /users/me - Get current user's complete profile
    this.router.get(
      "/me",
      this.authMiddleware.authenticate,
      this.userController.getMyProfile
    );

    // PUT /users/me - Update current user's profile
    this.router.put(
      "/me",
      [
        body("username")
          .optional()
          .isLength({ min: 3, max: 30 })
          .withMessage("Username must be between 3 and 30 characters")
          .matches(/^[a-zA-Z0-9_-]+$/)
          .withMessage(
            "Username can only contain letters, numbers, underscores, and hyphens"
          )
          .trim(),
        body("display_name")
          .optional()
          .isLength({ min: 1, max: 100 })
          .withMessage("Display name must be between 1 and 100 characters")
          .trim(),
      ],
      this.validateRequest,
      this.authMiddleware.authenticate,
      this.userController.updateMyProfile
    );

    // DELETE /users/me - Delete/deactivate current user's account
    this.router.delete(
      "/me",
      this.authMiddleware.authenticate,
      this.userController.deleteMyAccount
    );
  }

  // Validation middleware to handle express-validator errors
  private validateRequest = (req: any, res: any, next: any): void => {
    const { validationResult } = require("express-validator");
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const response = {
        success: false,
        error: "Validation failed",
        details: errors.array().map((error: any) => ({
          field: error.param,
          message: error.msg,
          value: error.value,
        })),
      };

      res.status(400).json(response);
      return;
    }

    next();
  };

  public getRouter(): Router {
    return this.router;
  }
}

export default UserRoutes;
