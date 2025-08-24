import { dictionaryService } from "../services/DictionaryService";

export class DictionaryController {
  // GET /api/dictionary/validate/:word
  validateWord = async (req: Request, res: Response): Promise<void> => {
    try {
      const { word } = req.params;

      if (!word || word.length !== 5) {
        res.status(400).json({
          success: false,
          message: "Word must be exactly 5 letters",
        });
        return;
      }

      const isValid = await dictionaryService.validateWord(word);

      res.json({
        success: true,
        data: {
          word: word.toUpperCase(),
          isValid,
        },
      });
    } catch (error) {
      console.error("Error validating word:", error);
      res.status(500).json({
        success: false,
        message: "Failed to validate word",
      });
    }
  };

  // GET /api/dictionary/stats
  getDictionaryStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const wordCount = await dictionaryService.getWordCount();

      res.json({
        success: true,
        data: {
          totalWords: wordCount,
          source: "GitHub + Redis Cache + Fallback",
        },
      });
    } catch (error) {
      console.error("Error getting dictionary stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get dictionary stats",
      });
    }
  };

  // POST /api/dictionary/refresh (Admin only)
  refreshDictionary = async (req: Request, res: Response): Promise<void> => {
    try {
      // In real implementation, check admin permissions
      await dictionaryService.refreshDictionary();
      const wordCount = await dictionaryService.getWordCount();

      res.json({
        success: true,
        message: "Dictionary refreshed successfully",
        data: {
          totalWords: wordCount,
        },
      });
    } catch (error) {
      console.error("Error refreshing dictionary:", error);
      res.status(500).json({
        success: false,
        message: "Failed to refresh dictionary",
      });
    }
  };
}
