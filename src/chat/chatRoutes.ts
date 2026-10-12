import { Router } from "express";
import { AuthenticatedRequest } from "../auth/authTypes";
import { requireAuth } from "../auth/authMiddleware";
import {
  addMessage,
  createConversation,
  getMessages,
  listConversations,
} from "./chatService";

export const chatRouter = Router();

chatRouter.use(requireAuth);

chatRouter.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const conversations = await listConversations(req.user.id);

    return res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Chat list error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load chats",
    });
  }
});

chatRouter.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const title =
      typeof req.body?.title === "string" && req.body.title.trim()
        ? req.body.title.trim()
        : "New Chat";

    const conversation = await createConversation(req.user.id, title);

    return res.status(201).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Chat creation error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not create chat",
    });
  }
});

chatRouter.get("/:conversationId/messages", async (
  req: AuthenticatedRequest,
  res
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId;

    const messages = await getMessages(req.user.id, conversationId);

    return res.json({
      success: true,
      conversationId,
      messages,
    });
  } catch {
    return res.status(404).json({
      success: false,
      message: "Chat conversation not found",
    });
  }
});

chatRouter.post("/:conversationId/messages", async (
  req: AuthenticatedRequest,
  res
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId;

    const { role, content } = req.body ?? {};

    if (
      (role !== "user" && role !== "assistant") ||
      typeof content !== "string" ||
      !content.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid role and content are required",
      });
    }

    await addMessage({
      userId: req.user.id,
      conversationId,
      role,
      content: content.trim().slice(0, 20000),
    });

    return res.status(201).json({
      success: true,
    });
  } catch {
    return res.status(404).json({
      success: false,
      message: "Chat conversation not found",
    });
  }
});
