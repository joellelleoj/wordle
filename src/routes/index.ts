import { Router } from "express";
import { AuthRoutes } from "./authRoutes";

export class AppRoutes {
  private router: Router;
  private authRoutes: AuthRoutes;

  constructor() {
    this.router = Router();
    this.authRoutes = new AuthRoutes();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Mount authentication routes
    this.router.use("/auth", this.authRoutes.getRouter());

    // Health check for entire user service
    this.router.get("/health", (req, res) => {
      res.status(200).json({
        success: true,
        service: "user-service",
        status: "healthy",
        timestamp: new Date().toISOString(),
        endpoints: {
          auth: "/api/auth",
        },
      });
    });
  }

  getRouter(): Router {
    return this.router;
  }
}
