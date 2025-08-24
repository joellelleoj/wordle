import { Router, Request, Response } from 'express';
import { GameServiceProxy } from '../services/GameServiceProxy';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

export const createGameRoutes = (gameServiceProxy: GameServiceProxy): Router => {
  const router = Router();

  // Validation schemas
  const startGameSchema = {
    // No body validation needed for start game
  };

  const submitGuessSchema = {
    body: {
      gameId: { type: 'string', required: true, minLength: 1 },
      guess: { 
        type: 'string', 
        required: true, 
        minLength: 5, 
        maxLength: 5,
        pattern: /^[A-Za-z]+$/
      }
    }
  };

  const validateWordSchema = {
    body: {
      word: { 
        type: 'string', 
        required: true, 
        minLength: 5, 
        maxLength: 5,
        pattern: /^[A-Za-z]+$/
      }
    }
  };

  /**
   * POST /api/game/start - Start new game
   */
  router.post('/start', 
    authenticateToken,
    validateRequest(startGameSchema),
    async (req: Request, res: Response) => {
      try {
        const response = await gameServiceProxy.forwardRequest(
          'POST',
          '/game/start',
          req.body,
          { authorization: req.headers.authorization as string }
        );

        res.status(response.status).json(response.data);
      } catch (error: any) {
        res.status(error.status || 500).json(error.data || { error: error.message });
      }
    }
  );

  /**
   * POST /api/game/guess - Submit guess
   */
  router.post('/guess',
    authenticateToken,
    validateRequest(submitGuessSchema),
    async (req: Request, res: Response) => {
      try {
        // Additional validation - ensure guess is uppercase
        req.body.guess = req.body.guess.toUpperCase();

        const response = await gameServiceProxy.forwardRequest(
          'POST',
          '/game/guess',
          req.body,
          { authorization: req.headers.authorization as string }
        );

        res.status(response.status).json(response.data);
      } catch (error: any) {
        res.status(error.status || 500).json(error.data || { error: error.message });
      }
    }
  );

  /**
   * GET /api/game/current - Get current game
   */
  router.get('/current',
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const response = await gameServiceProxy.forwardRequest(
          'GET',
          '/game/current',
          undefined,
          { authorization: req.headers.authorization as string }
        );

        res.status(response.status).json(response.data);
      } catch (error: any) {
        // Transform 404 to more user-friendly message
        if (error.status === 404) {
          res.status(404).json({
            success: false,
            error: 'No active game found',
            message: 'Start a new game to begin playing'
          });
        } else {
          res.status(error.status || 500).json(error.data || { error: error.message });
        }
      }
    }
  );

  /**
   * GET /api/game/history - Get game history
   */
  router.get('/history',
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        // Forward query parameters
        const queryParams = new URLSearchParams();
        if (req.query.limit) queryParams.append('limit', req.query.limit as string);
        if (req.query.offset) queryParams.append('offset', req.query.offset as string);

        const path = `/game/history${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

        const response =