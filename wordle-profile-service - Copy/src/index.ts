import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'profile-service',
    timestamp: new Date().toISOString()
  });
});

app.get('/profile/:userId', (req, res) => {
  res.json({
    success: true,
    profile: {
      userId: req.params.userId,
      username: 'demo_user',
      gamesPlayed: 5,
      gamesWon: 3,
      winRate: 60,
      currentStreak: 2,
      maxStreak: 3
    }
  });
});

app.listen(PORT, () => {
  console.log(`👥 Profile Service running on port ${PORT}`);
});
