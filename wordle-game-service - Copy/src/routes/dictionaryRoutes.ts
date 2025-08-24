import { Router } from "express";
import {
  DictionaryController,
  validateWord,
} from "../controllers/DictionaryController";

const router = Router();
const dictionaryController = new DictionaryController();

// Dictionary routes
router.get("/validate/:word", validateWord, dictionaryController.validateWord);
router.get("/stats", dictionaryController.getDictionaryStats);
router.post("/refresh", dictionaryController.refreshDictionary);

export { router as dictionaryRoutes };
