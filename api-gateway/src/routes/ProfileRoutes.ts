import { Router, Request, Response, NextFunction } from "express";
import axios from "axios";

export class ProfileRoutes {
  private router: Router;
  private profileServiceUrl: string;

  constructor() {
    this.router = Router();
    this.profileServiceUrl =
      process.env.PROFILE_SERVICE_URL || "http://localhost:3004";
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.use(this.requireAuth);

    /**
     * @swagger
     * /api/profile/games:
     *   get:
     *     summary: Get user's saved games
     *     tags: [Profile]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Games retrieved successfully
     *       401:
     *         description: Authentication required
     *   post:
     *     summary: Save a completed game
     *     tags: [Profile]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Game saved successfully
     *       401:
     *         description: Authentication required
     */

    this.router.post("/games", this.forwardRequest.bind(this));
    this.router.get("/games", this.forwardRequest.bind(this));
    this.router.get("/games/:gameId", this.forwardRequest.bind(this));

    /**
     * @swagger
     * /api/profile/stats:
     *   get:
     *     summary: Get user game statistics
     *     description: Returns comprehensive game statistics for the authenticated user
     *     tags: [Profile]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: User statistics
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 stats:
     *                   $ref: '#/components/schemas/GameStats'
     *       401:
     *         description: Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.get("/stats", this.forwardRequest.bind(this));

    // Album-Game relationship routes (MUST come before generic album routes)
    this.router.post(
      "/albums/:albumId/games/:gameId",
      this.forwardRequest.bind(this)
    );
    this.router.delete(
      "/albums/:albumId/games/:gameId",
      this.forwardRequest.bind(this)
    );

    this.router.get(
      "/games/:gameId/visualization",
      this.forwardRequest.bind(this)
    );

    /**
     * @swagger
     * /api/profile/albums:
     *   get:
     *     summary: Get user's game albums
     *     tags: [Profile]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Albums retrieved successfully
     *       401:
     *         description: Authentication required
     *   post:
     *     summary: Create a new album
     *     tags: [Profile]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Album created successfully
     *       401:
     *         description: Authentication required
     */
    this.router.post("/albums", this.forwardRequest.bind(this));
    this.router.get("/albums", this.forwardRequest.bind(this));
    this.router.get("/albums/:albumId", this.forwardRequest.bind(this));
    this.router.put("/albums/:albumId", this.forwardRequest.bind(this));
    this.router.delete("/albums/:albumId", this.forwardRequest.bind(this));
  }

  private requireAuth = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.auth?.isAuthenticated) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
        message: "Please log in to access profile features",
      });
      return;
    }
    next();
  };

  private forwardRequest = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const targetUrl = `${this.profileServiceUrl}/api${req.path}`;

      console.log(
        `Forwarding ${req.method} ${req.originalUrl} to ${targetUrl}`
      );
      console.log(`Auth context: ${req.auth?.user?.username || "anonymous"}`);
      const response = await axios({
        method: req.method as any,
        url: targetUrl,
        data: req.body,
        params: req.query,
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.authorization || "",
          // Forward the auth context
          "X-User-ID": req.auth?.user?.id || "",
          "X-User-Username": req.auth?.user?.username || "",
        },
        timeout: 10000,
      });
      console.log(`Profile service responded: ${response.status}`);
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error("Profile service forwarding error:", error.message);

      if (error.response) {
        console.error("Error response data:", error.response.data);
        res.status(error.response.status).json(error.response.data);
      } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        res.status(503).json({
          success: false,
          error: "Profile service unavailable",
          details: `Cannot connect to profile service at ${this.profileServiceUrl}`,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to process profile request",
          details: error.message,
        });
      }
    }
  };

  public getRouter(): Router {
    return this.router;
  }
}
