import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import morgan from "morgan";

const app = express();
const PORT = process.env.PORT || 8082; // MUST be 8082 for devstud server

// ============================================================================
// SECURITY & MIDDLEWARE
// ============================================================================

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration for frontend
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.10.11:8080",
      "https://devstud.imn.htwk-leipzig.de",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Request logging
app.use(morgan("combined"));

// Rate limiting - more restrictive for public API
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ============================================================================
// SERVICE DISCOVERY & HEALTH CHECKS
// ============================================================================

interface ServiceConfig {
  name: string;
  url: string;
  healthEndpoint: string;
  timeout: number;
}

const services: { [key: string]: ServiceConfig } = {
  game: {
    name: "game-service",
    url: process.env.GAME_SERVICE_URL || "http://game-service:3001",
    healthEndpoint: "/health",
    timeout: 30000,
  },
  user: {
    name: "user-service",
    url: process.env.USER_SERVICE_URL || "http://user-service:3002",
    healthEndpoint: "/health",
    timeout: 30000,
  },
  profile: {
    name: "profile-service",
    url: process.env.PROFILE_SERVICE_URL || "http://profile-service:3003",
    healthEndpoint: "/health",
    timeout: 30000,
  },
};

// Health check for individual services
async function checkServiceHealth(service: ServiceConfig): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${service.url}${service.healthEndpoint}`, {
      signal: controller.signal,
      headers: { "User-Agent": "API-Gateway-Health-Check/1.0" },
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn(`❌ Health check failed for ${service.name}:`, error.message);
    return false;
  }
}

// ============================================================================
// GATEWAY ROUTES & PROXYING
// ============================================================================

// Health check endpoint for the gateway itself
app.get("/health", async (req, res) => {
  const serviceHealths: { [key: string]: boolean } = {};

  // Check all services
  for (const [name, config] of Object.entries(services)) {
    serviceHealths[name] = await checkServiceHealth(config);
  }

  const allHealthy = Object.values(serviceHealths).every((health) => health);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "healthy" : "degraded",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    uptime: process.uptime(),
    services: serviceHealths,
  });
});

// API Documentation
app.get("/docs", (req, res) => {
  res.json({
    title: "Wordle Game API Gateway",
    version: "1.0.0",
    description: "Centralized API gateway for the Wordle microservices",
    services: {
      game: {
        description: "Game logic and word validation",
        endpoints: [
          "POST /api/game/start - Start new game",
          "POST /api/game/:id/guess - Make a guess",
          "GET /api/game/:id - Get game state",
          "GET /api/dictionary/validate/:word - Validate word",
        ],
      },
      user: {
        description: "User authentication and management",
        endpoints: [
          "POST /api/users/register - Register new user",
          "POST /api/users/login - User login",
          "GET /api/users/profile - Get user profile",
        ],
      },
      profile: {
        description: "User profiles and game statistics",
        endpoints: [
          "GET /api/profile/:userId - Get user profile",
          "POST /api/profile/posts - Create game post",
          "GET /api/profile/stats/:userId - Get user statistics",
        ],
      },
    },
  });
});

// ============================================================================
// PROXY MIDDLEWARE CONFIGURATION
// ============================================================================

// Common proxy options
const createProxyOptions = (
  service: ServiceConfig,
  pathRewrite?: { [key: string]: string }
) => ({
  target: service.url,
  changeOrigin: true,
  timeout: service.timeout,
  pathRewrite: pathRewrite || {},
  onError: (err: Error, req: any, res: any) => {
    console.error(`❌ Proxy error for ${service.name}:`, err.message);
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        message: `Service temporarily unavailable: ${service.name}`,
        error: "PROXY_ERROR",
      });
    }
  },
  onProxyReq: (proxyReq: any, req: any) => {
    // Add gateway headers
    proxyReq.setHeader("X-Gateway-Source", "api-gateway");
    proxyReq.setHeader("X-Request-ID", generateRequestId());
    proxyReq.setHeader("X-Forwarded-Host", req.get("host"));

    // Log proxy request
    console.log(
      `🔄 Proxying ${req.method} ${req.originalUrl} → ${service.name}`
    );
  },
  onProxyRes: (proxyRes: any, req: any, res: any) => {
    // Add CORS headers to proxied responses
    res.header("Access-Control-Allow-Origin", req.get("origin") || "*");
    res.header("Access-Control-Allow-Credentials", "true");
  },
});

// Request ID generator
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// SERVICE PROXIES
// ============================================================================

// Game Service Proxy
app.use(
  "/api/game",
  createProxyMiddleware(
    createProxyOptions(services.game, {
      "^/api/game": "/api/game",
    })
  )
);

app.use(
  "/api/dictionary",
  createProxyMiddleware(
    createProxyOptions(services.game, {
      "^/api/dictionary": "/api/dictionary",
    })
  )
);

// User Service Proxy
app.use(
  "/api/users",
  createProxyMiddleware(
    createProxyOptions(services.user, {
      "^/api/users": "/api/users",
    })
  )
);

app.use(
  "/api/auth",
  createProxyMiddleware(
    createProxyOptions(services.user, {
      "^/api/auth": "/api/auth",
    })
  )
);

// Profile Service Proxy
app.use(
  "/api/profile",
  createProxyMiddleware(
    createProxyOptions(services.profile, {
      "^/api/profile": "/api/profile",
    })
  )
);

app.use(
  "/api/stats",
  createProxyMiddleware(
    createProxyOptions(services.profile, {
      "^/api/stats": "/api/stats",
    })
  )
);

// ============================================================================
// ERROR HANDLING & FALLBACKS
// ============================================================================

// Route not found handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      game: [
        "/api/game/start",
        "/api/game/:id/guess",
        "/api/dictionary/validate/:word",
      ],
      user: ["/api/users/register", "/api/users/login", "/api/auth/profile"],
      profile: ["/api/profile/:userId", "/api/stats/:userId"],
    },
  });
});

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("❌ Gateway Error:", err);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal gateway error",
    error:
      process.env.NODE_ENV === "development" ? err.stack : "INTERNAL_ERROR",
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 API Gateway running on port ${PORT}`);
  console.log(
    `📍 Server constraint compliance: Port ${PORT} → /dev11/api route`
  );
  console.log("🔗 Configured service routes:");
  console.log("   • Game Service:", services.game.url);
  console.log("   • User Service:", services.user.url);
  console.log("   • Profile Service:", services.profile.url);
  console.log("🏥 Health check available at /health");
  console.log("📚 API documentation available at /docs");
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`🛑 ${signal} received, shutting down gracefully...`);

  server.close(() => {
    console.log("✅ API Gateway shut down successfully");
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.log("⚡ Forcing shutdown...");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
