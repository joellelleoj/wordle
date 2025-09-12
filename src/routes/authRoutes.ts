/*import { Router } from "express";
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
*/
// user-service/src/routes/authRoutes.ts - FIXED: Single callback endpoint
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

    // GitLab OAuth routes - FIXED: Single callback endpoint
    this.router.get("/gitlab/login", this.authController.gitlabLogin);

    // CRITICAL FIX: Single callback route that handles both GET and POST
    this.router.all("/callback", this.authController.gitlabCallback);

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
        routes: [
          "GET /gitlab/login",
          "ALL /callback", // Handles both GET and POST
          "POST /register",
          "POST /login",
          "POST /refresh",
          "POST /logout",
          "GET /me",
        ],
      });
    });

    // Debug route
    this.router.get("/routes", (req, res) => {
      res.json({
        success: true,
        note: "OAuth callback now uses single endpoint for both GET and POST",
        availableRoutes: [
          "GET /gitlab/login - Initiate OAuth",
          "GET|POST /callback - GitLab OAuth callback (universal)",
          "POST /register - Traditional registration",
          "POST /login - Traditional login",
          "POST /refresh - Refresh JWT tokens",
          "POST /logout - Logout user",
          "GET /me - Get current user (protected)",
          "GET /health - Service health check",
        ],
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
