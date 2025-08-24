import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// In-memory user storage (replace with database later)
interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
}

const users: User[] = [];

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'user-service',
    timestamp: new Date().toISOString()
  });
});

// Auth routes
app.post('/auth/register', (req, res) => {
  const { email, username, password } = req.body;
  
  // Basic validation
  if (!email || !username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }
  
  // Check if user exists
  const existingUser = users.find(u => u.email === email || u.username === username);
  if (existingUser) {
    return res.status(409).json({
      success: false,
      error: 'User already exists'
    });
  }
  
  // Create user (password hashing would go here)
  const newUser: User = {
    id: Date.now().toString(),
    email,
    username,
    passwordHash: password, // In real app: await bcrypt.hash(password, 10)
    createdAt: new Date()
  };
  
  users.push(newUser);
  
  res.status(201).json({
    success: true,
    user: {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      createdAt: newUser.createdAt
    },
    token: 'fake_jwt_token_' + newUser.id
  });
});

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  const user = users.find(u => u.email === email);
  if (!user || user.passwordHash !== password) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
  
  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      username: user.username
    },
    token: 'fake_jwt_token_' + user.id
  });
});

app.get('/auth/me', (req, res) => {
  // In real app: verify JWT token from Authorization header
  res.json({
    success: true,
    user: {
      id: '1',
      email: 'demo@example.com',
      username: 'demo'
    }
  });
});

app.listen(PORT, () => {
  console.log(`👤 User Service running on port ${PORT}`);
});
