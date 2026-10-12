import { randomUUID } from "crypto";
import { pool, withTransaction } from "../db/database";

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export async function createConversation(
  userId: string,
  title = "New Chat"
): Promise<ChatConversation> {
  const id = randomUUID();

  const result = await pool.query(
    `INSERT INTO chat_conversations (id, user_id, title)
     VALUES ($1,$2,$3)
     RETURNING id, title, created_at, updated_at`,
    [id, userId, title.trim().slice(0, 120) || "New Chat"]
  );

  return mapConversation(result.rows[0]);
}

export async function getConversation(
  userId: string,
  conversationId: string
): Promise<ChatConversation | undefined> {
  const result = await pool.query(
    `SELECT id, title, created_at, updated_at
     FROM chat_conversations
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [conversationId, userId]
  );

  return result.rowCount ? mapConversation(result.rows[0]) : undefined;
}

export async function getOrCreateGeneralConversation(
  userId: string
): Promise<ChatConversation> {
  const existing = await pool.query(
    `SELECT id, title, created_at, updated_at
     FROM chat_conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId]
  );

  if (existing.rowCount) {
    return mapConversation(existing.rows[0]);
  }

  return createConversation(userId, "General Chat");
}

export async function listConversations(
  userId: string
): Promise<ChatConversation[]> {
  const result = await pool.query(
    `SELECT id, title, created_at, updated_at
     FROM chat_conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 100`,
    [userId]
  );

  return result.rows.map(mapConversation);
}


export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export async function getRecentMessages(
  userId: string,
  conversationId: string,
  limit = 12
): Promise<ChatMessage[]> {
  const ownership = await getConversation(userId, conversationId);

  if (!ownership) {
    throw new Error("Chat conversation not found");
  }

  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 30));

  const result = await pool.query(
    `SELECT id, role, content, created_at
     FROM chat_messages
     WHERE conversation_id = $1
     ORDER BY message_order DESC
     LIMIT $2`,
    [conversationId, safeLimit]
  );

  return result.rows
    .reverse()
    .map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: new Date(row.created_at).toISOString(),
    }));
}


export async function replaceConversationHistory(params: {
  userId: string;
  conversationId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<void> {
  await withTransaction(async (client) => {
    const ownership = await client.query(
      "SELECT id FROM chat_conversations WHERE id = $1 AND user_id = $2 LIMIT 1",
      [params.conversationId, params.userId]
    );
    if (!ownership.rowCount) throw new Error("Chat conversation not found");

    await client.query("DELETE FROM chat_messages WHERE conversation_id = $1", [params.conversationId]);
    const messages = params.messages.slice(-12);
    for (let index = 0; index < messages.length; index += 1) {
      const item = messages[index];
      const content = item.content.trim().slice(0, 20000);
      if (!content) continue;
      await client.query(
        `INSERT INTO chat_messages (id, conversation_id, message_order, role, content)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), params.conversationId, index, item.role, content]
      );
    }
    await client.query(
      "UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1 AND user_id = $2",
      [params.conversationId, params.userId]
    );
  });
}

export async function addMessage(params: {
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
}): Promise<void> {
  const ownership = await pool.query(
    `SELECT id FROM chat_conversations
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [params.conversationId, params.userId]
  );

  if (!ownership.rowCount) {
    throw new Error("Chat conversation not found");
  }

  const orderResult = await pool.query(
    `SELECT COALESCE(MAX(message_order), -1) + 1 AS next_order
     FROM chat_messages
     WHERE conversation_id = $1`,
    [params.conversationId]
  );

  const messageOrder = Number(orderResult.rows[0].next_order);

  await pool.query(
    `INSERT INTO chat_messages
      (id, conversation_id, message_order, role, content)
     VALUES ($1,$2,$3,$4,$5)`,
    [
      randomUUID(),
      params.conversationId,
      messageOrder,
      params.role,
      params.content,
    ]
  );

  await pool.query(
    `UPDATE chat_conversations
     SET updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [params.conversationId, params.userId]
  );
}

export async function getMessages(
  userId: string,
  conversationId: string
) {
  const ownership = await getConversation(userId, conversationId);

  if (!ownership) {
    throw new Error("Chat conversation not found");
  }

  const result = await pool.query(
    `SELECT id, role, content, created_at
     FROM chat_messages
     WHERE conversation_id = $1
     ORDER BY message_order ASC`,
    [conversationId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }));
}

function mapConversation(row: {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}): ChatConversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
