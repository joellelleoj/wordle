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
    this.router.post("/register", this.authController.register);
    this.router.post("/login", this.authController.login);
    this.router.get("/gitlab/login", this.authController.gitlabLogin);
    this.router.all("/callback", this.authController.gitlabCallback);
    this.router.post("/refresh", this.authController.refreshToken);
    this.router.post("/logout", this.authController.logout);
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

    // Debug route
    this.router.get("/routes", (req, res) => {
      res.json({
        success: true,
        redirectUri:
          process.env.GITLAB_REDIRECT_URI ||
          "http://localhost:3003/api/v1/auth/callback",
      });
    });
  }

  getRouter(): Router {
    return this.router;
  }
}
