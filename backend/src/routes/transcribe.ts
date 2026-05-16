// backend/src/routes/transcribe.ts
import { Router} from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { transcribeAudio } from "../services/assemblyService.js";

const router   = Router();
const upload   = multer({
  storage: multer.memoryStorage(),   // keep file in RAM as buffer
  limits:  { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

/**
 * POST /transcribe
 * Expects: multipart/form-data  →  field "audio"  (webm / mp4 / wav / mp3 …)
 * Returns: { text: string }
 */
router.post(
  "/",
  upload.single("audio"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No audio file uploaded" });
        return;
      }

      const mimeType = req.file.mimetype || "audio/webm";
      const text     = await transcribeAudio(req.file.buffer, mimeType);

      res.json({ text });
    } catch (err: unknown) {
      console.error("[transcribe]", err);
      const message =
        err instanceof Error ? err.message : "Transcription failed";
      res.status(500).json({ error: message });
    }
  }
);

export default router;