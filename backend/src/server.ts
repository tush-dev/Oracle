import "dotenv/config";
import express from "express";
import cors from "cors";
import { Router } from "express";
import multer from "multer";
import test from "./routes/pdf.js";
import historyRouter from "./routes/history.js";
import githubAuthRouter from "./routes/githubAuth.js";
import { requireClerkSession } from "./middleware/requireClerk.js";
import documentRouter from "./routes/document.js";
import transcribeRouter from "./routes/transcribe.js";
import githubRouter from "./routes/github.js";          // ← ADD

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed = [
        "http://localhost:5173",
        /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/,
      ];
      const ok = allowed.some((a) =>
        typeof a === "string" ? origin === a : a.test(origin)
      );
      cb(null, ok);
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const PORT = process.env.PORT || 3009;
const data = multer().single("File");

const router1 = Router();
app.use(router1);

router1.post("/query",           requireClerkSession, data, test);
router1.use("/history",          historyRouter);
router1.use("/auth/github",      githubAuthRouter);
router1.use("/documents",        documentRouter);
router1.use("/transcribe",       requireClerkSession, transcribeRouter);
router1.use("/github",           githubRouter);          // ← ADD

app.listen(PORT, function (err: unknown) {
  if (err) console.log(err);
  console.log("Server listening on PORT", PORT);
});