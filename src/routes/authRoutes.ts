import { Router } from "express";
import { AuthController } from "../controllers/authController";
import { AuthMiddleware } from "../middleware/authMiddleware";

export class AuthRoutes {
  private router: Router;
  private authController: AuthController;
  private authMiddleware: AuthMiddleware;

  constructor() {
    this.router = Router();
    this.authController = new AuthController();
    this.authMiddleware = new AuthMiddleware();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Public routes
    this.router.post("/register", this.authController.register);
    this.router.post("/login", this.authController.login);

    // GitLab OAuth routes
    this.router.get("/gitlab/login", this.authController.gitlabLogin);
    this.router.get("/callback", this.authController.gitlabCallbackGet); // GET callback for redirects
    this.router.post("/callback", this.authController.gitlabCallback); // POST callback for API

    // Token management
    this.router.post("/refresh", this.authController.refreshToken);
    this.router.post("/logout", this.authController.logout);

    // Protected routes - require authentication
    this.router.get(
      "/me",
      this.authMiddleware.authenticate,
      this.authController.getMe
    );

    // Health check
    this.router.get("/health", (req, res) => {
      res.status(200).json({
        success: true,
        service: "auth-service",
        status: "healthy",
        timestamp: new Date().toISOString(),
      });
    });

    // Debug route to list all routes
    this.router.get("/routes", (req, res) => {
      res.json({
        success: true,
        availableRoutes: [
          "GET /gitlab/login",
          "GET /callback",
          "POST /callback",
          "POST /register",
          "POST /login",
          "POST /refresh",
          "POST /logout",
          "GET /me",
          "GET /health",
        ],
      });
    });
  }

  getRouter(): Router {
    return this.router;
  }
}
