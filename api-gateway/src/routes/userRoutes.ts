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
    this.router.all("*", this.forwardToUserService);
  }

  private forwardToUserService = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      let targetPath = req.originalUrl;
      if (targetPath.startsWith("/api/users/auth/")) {
        // Replace /api/users/auth/ with /api/v1/auth/
        targetPath = targetPath.replace("/api/users/auth/", "/api/v1/auth/");
      } else if (targetPath.startsWith("/api/users/")) {
        // Replace /api/users/ with /api/v1/auth/ for other user endpoints
        targetPath = targetPath.replace("/api/users/", "/api/v1/auth/");
      }

      const targetUrl = `${this.userServiceUrl}${targetPath}`;
      console.log(`Forwarding ${req.method}`);

      const fetch = (await import("node-fetch")).default;
      const forwardHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (req.headers.authorization) {
        forwardHeaders["Authorization"] = req.headers.authorization;
      }

      if (req.headers["user-agent"]) {
        forwardHeaders["User-Agent"] = req.headers["user-agent"] as string;
      }

      const requestOptions: any = {
        method: req.method,
        headers: forwardHeaders,
        redirect: "manual",
      };
      if (req.method !== "GET" && req.method !== "HEAD") {
        requestOptions.body = JSON.stringify(req.body);
      }
      const response = await fetch(targetUrl, requestOptions);

      console.log(
        `User service response: ${response.status} ${response.statusText}`
      );

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (location) {
          console.log(`Redirect to: ${location}`);
          res.redirect(response.status, location);
          return;
        }
      }
      response.headers.forEach((value, key) => {
        if (key !== "content-length" && key !== "transfer-encoding") {
          res.setHeader(key, value);
        }
      });

      res.status(response.status);
      const data = await response.text();

      try {
        if (data && data.trim().length > 0) {
          res.json(JSON.parse(data));
        } else {
          res.end();
        }
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
        originalUrl: req.originalUrl,
        targetService: this.userServiceUrl,
      });
    }
  };

  getRouter(): Router {
    return this.router;
  }
}
