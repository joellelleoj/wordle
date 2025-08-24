import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Game words
const WORDS = ['HELLO', 'WORLD', 'REACT', 'TYPES', 'GAMES', 'QUICK', 'BROWN', 'JUMPS'];

// In-memory game storage
interface Game {
  id: string;
  userId?: string;
  targetWord: string;
  guesses: string[];
  status: 'active' | 'won' | 'lost';
  maxGuesses: number;
  startTime: Date;
}

const games: Game[] = [];

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'game-service',
    timestamp: new Date().toISOString()
  });
});

app.post('/game/start', (req, res) => {
  const targetWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  
  const game: Game = {
    id: Date.now().toString(),
    userId: req.body.userId,
    targetWord,
    guesses: [],
    status: 'active',
    maxGuesses: 6,
    startTime: new Date()
  };
  
  games.push(game);
  
  res.json({
    success: true,
    game: {
      id: game.id,
      guesses: game.guesses,
      status: game.status,
      maxGuesses: game.maxGuesses,
      startTime: game.startTime
      // Note: targetWord is hidden from response
    }
  });
});

app.post('/game/guess', (req, res) => {
  const { gameId, guess } = req.body;
  
  const game = games.find(g => g.id === gameId);
  if (!game) {
    return res.status(404).json({
      success: false,
      error: 'Game not found'
    });
  }
  
  if (game.status !== 'active') {
    return res.status(400).json({
      success: false,
      error: 'Game is not active'
    });
  }
  
  const guessUpper = guess.toUpperCase();
  game.guesses.push(guessUpper);
  
  // Evaluate guess
  const result = evaluateGuess(guessUpper, game.targetWord);
  const isWon = result.every(r => r.status === 'correct');
  const isLost = game.guesses.length >= game.maxGuesses && !isWon;
  
  if (isWon) game.status = 'won';
  if (isLost) game.status = 'lost';
  
  res.json({
    success: true,
    result: {
      guess: guessUpper,
      evaluation: result,
      isGameWon: isWon,
      isGameOver: isWon || isLost,
      gameStatus: game.status,
      targetWord: (isWon || isLost) ? game.targetWord : undefined
    }
  });
});

function evaluateGuess(guess: string, target: string) {
  const result = [];
  const targetLetters = target.split('');
  const guessLetters = guess.split('');
  
  // Mark correct positions first
  for (let i = 0; i < guessLetters.length; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      result[i] = { letter: guessLetters[i], status: 'correct' };
      targetLetters[i] = ''; // Mark as used
    }
  }
  
  // Mark present/absent positions
  for (let i = 0; i < guessLetters.length; i++) {
    if (result[i]) continue; // Already marked as correct
    
    const letterIndex = targetLetters.indexOf(guessLetters[i]);
    if (letterIndex !== -1) {
      result[i] = { letter: guessLetters[i], status: 'present' };
      targetLetters[letterIndex] = ''; // Mark as used
    } else {
      result[i] = { letter: guessLetters[i], status: 'absent' };
    }
  }
  
  return result;
}

app.get('/dict/validate/:word', (req, res) => {
  const word = req.params.word.toUpperCase();
  const isValid = WORDS.includes(word) || word.length === 5;
  
  res.json({
    success: true,
    isValid,
    word
  });
});

app.listen(PORT, () => {
  console.log(`🎮 Game Service running on port ${PORT}`);
});
