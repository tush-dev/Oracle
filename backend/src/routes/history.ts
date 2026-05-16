import { Router } from "express";
import { requireClerkSession } from "../middleware/requireClerk.js";
import {
  getUserChats,
  getChatMessagesForUser,
  deleteChat,
} from "../services/historyService.js";

const router = Router();

router.use(requireClerkSession);

router.get("/chats", async (req, res) => {
  try {
    const chats = await getUserChats(req.supabaseUserId!);
    res.json({ chats });
  } catch {
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

router.get("/messages/:chatId", async (req, res) => {
  try {
    const messages = await getChatMessagesForUser(
      req.params.chatId,
      req.supabaseUserId!,
    );
    if (!messages) {
      return res.status(404).json({ error: "Chat not found" });
    }
    res.json({ messages });
  } catch {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.delete("/chats/:chatId", async (req, res) => {
  try {
    await deleteChat(req.params.chatId, req.supabaseUserId!);
    res.json({ message: "Chat deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

export default router;
