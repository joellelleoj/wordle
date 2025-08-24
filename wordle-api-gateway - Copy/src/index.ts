import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'api-gateway',
    version: '1.0.0'
  });
});

// Service proxy routes (will proxy to actual services when they're running)
const services = {
  user: process.env.USER_SERVICE_URL || 'http://localhost:3002',
  game: process.env.GAME_SERVICE_URL || 'http://localhost:3003',
  profile: process.env.PROFILE_SERVICE_URL || 'http://localhost:3004'
};

// Proxy middleware configuration
const proxyOptions = {
  changeOrigin: true,
  pathRewrite: {
    '^/api/auth': '/auth',
    '^/api/game': '/game', 
    '^/api/profile': '/profile'
  },
  onError: (err: any, req: any, res: any) => {
    console.error('Proxy error:', err.message);
    res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      message: 'The requested service is not available right now.'
    });
  }
};

// Route proxying (these will work when the services are running)
app.use('/api/auth', createProxyMiddleware({
  target: services.user,
  ...proxyOptions
}));

app.use('/api/game', createProxyMiddleware({
  target: services.game,
  ...proxyOptions  
}));

app.use('/api/profile', createProxyMiddleware({
  target: services.profile,
  ...proxyOptions
}));

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Wordle API Gateway',
    status: 'running',
    services: Object.keys(services),
    endpoints: [
      'GET /health - Health check',
      'POST /api/auth/login - User login',
      'POST /api/auth/register - User registration', 
      'POST /api/game/start - Start new game',
      'POST /api/game/guess - Make a guess',
      'GET /api/profile/:id - Get user profile'
    ]
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} not found`
  });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`🚪 API Gateway running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 Proxy targets:`, services);
});
