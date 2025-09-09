import { Application } from "express";
import { AuthController } from "../controllers/authController";
import { UserController } from "../controllers/userController";
import { authRoutes } from "../routes/authRoutes";
import { userRoutes } from "../routes/userRoutes";

export class Server {
  constructor(private app: Application) {}

  public setupRoutes(): void {
    // Initialize controllers
    const authController = new AuthController();
    const userController = new UserController();

    // Setup routes
    this.app.use("/auth", authRoutes(authController));
    this.app.use("/api/users", userRoutes(userController));

    // API documentation
    this.app.get("/api/docs", (req, res) => {
      res.json({
        service: "User Service",
        version: "1.0.0",
        endpoints: {
          authentication: {
            "POST /auth/register": "Register a new user",
            "POST /auth/login": "Login user",
            "GET /auth/gitlab": "GitLab OAuth login",
            "GET /auth/gitlab/callback": "GitLab OAuth callback",
            "POST /auth/logout": "Logout user",
            "POST /auth/refresh": "Refresh JWT token",
          },
          users: {
            "GET /api/users/me": "Get current user profile",
            "PUT /api/users/me": "Update current user profile",
            "DELETE /api/users/me": "Delete current user account",
            "GET /api/users/search": "Search users by username",
          },
        },
      });
    });

    // Catch-all for undefined routes
    this.app.use("*", (req, res) => {
      res.status(404).json({
        error: "Endpoint not found",
        service: "user-service",
        availableEndpoints: "/api/docs",
      });
    });
  }
}
