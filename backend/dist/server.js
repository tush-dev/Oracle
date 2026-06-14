import "dotenv/config";
import express, {} from "express";
import cors from "cors";
import { Router } from "express";
import multer, { MulterError } from "multer";
import test from "./routes/pdf.js";
import historyRouter from "./routes/history.js";
import githubAuthRouter from "./routes/githubAuth.js";
import { requireClerkSession } from "./middleware/requireClerk.js";
import documentRouter from "./routes/document.js";
import transcribeRouter from "./routes/transcribe.js";
import githubRouter from "./routes/github.js";
const defaultOrigins = [
    "https://advanced-rag-pipeline.vercel.app",
    "https://advanced-rag-pipeline-git-test-joinwithyogesh17-9788s-projects.vercel.app",
    "http://localhost:5173"
];
const origins = process.env.FRONTEND_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean) ?? defaultOrigins;
const app = express();
app.use(express.json());
app.use(cors({
    origin: origins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
}));
const PORT = process.env.PORT || 3009;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: Number(process.env.MAX_UPLOAD_SIZE_BYTES ?? 50 * 1024 * 1024),
    },
});
const uploadSingle = upload.single("File");
function handleUpload(req, res, next) {
    uploadSingle(req, res, (err) => {
        if (err instanceof MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(413).json({ error: "File too large. Maximum size is 50 MB." });
            }
            if (err.code === "LIMIT_UNEXPECTED_FILE") {
                return res.status(400).json({ error: `Unexpected field: expected "File"` });
            }
            return res.status(400).json({ error: `Upload error: ${err.message}` });
        }
        if (err) {
            console.error("Upload middleware error:", err);
            return res.status(500).json({ error: "File upload failed." });
        }
        next();
    });
}
const router1 = Router();
app.use(router1);
router1.post("/query", requireClerkSession, handleUpload, test);
router1.use("/history", historyRouter);
router1.use("/auth/github", githubAuthRouter);
router1.use("/documents", documentRouter);
router1.use("/transcribe", requireClerkSession, transcribeRouter);
router1.use("/github", githubRouter);
app.listen(PORT, function (err) {
    if (err)
        console.log(err);
    console.log("Server listening on PORT", PORT);
});
//# sourceMappingURL=server.js.map