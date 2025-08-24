import { Router } from "express";
import { GameController, validateGuess } from "../controllers/GameController";

const router = Router();
const gameController = new GameController();

// Game routes
router.post("/start", gameController.startGame);
router.post("/:gameId/guess", validateGuess, gameController.makeGuess);
router.get("/:gameId", gameController.getGame);
router.get("/active/:userId", gameController.getActiveGame);

export { router as gameRoutes };



mport { Router } from 'express';
import { GameController } from '../controllers/GameController';
import { authenticateToken, optionalAuth } from '../middleware/auth';

export const createGameRoutes = (gameController: GameController): Router => {
  const router = Router();

  // Game management routes (require authentication)
  router.post('/start', authenticateToken, gameController.startGame);
  router.post('/guess', authenticateToken, gameController.submitGuess);
  router.get('/current', authenticateToken, gameController.getCurrentGame);
  router.get('/history', authenticateToken, gameController.getGameHistory);

  // Dictionary routes (public or optional auth)
  router.post('/validate', optionalAuth, gameController.validateWord);
  router.get('/dictionary/stats', gameController.getDictionaryStats);

  return router;
};
