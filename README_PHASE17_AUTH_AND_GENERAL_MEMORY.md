# ORBIT Phase 17 — Authentication + General Chat Memory Fix

This backend includes:
- Real PostgreSQL-backed user accounts
- bcrypt password hashing
- JWT access tokens
- Rotating/revocable refresh sessions
- Protected user-owned learning APIs
- Persistent user-owned general chat conversations

## General Chat memory fix

General Chat now uses the server-side chat history stored in `chat_conversations` and
`chat_messages` as the authoritative recent context (last 12 messages by default).
The client history is only a compatibility fallback when a conversation has no stored
messages.

The ORBIT General Chat system prompt explicitly preserves the active subject/entity,
resolves pronouns and omitted subjects from recent turns, honors explicit corrections,
and asks for clarification when multiple subjects are genuinely ambiguous.

Example:
- User: "tell me about Pakistan history"
- User: "about their prime minister line beginning to current"
  -> "their" remains Pakistan.
- User: "no, I mean Pakistan not America"
- User: "tell me current prime minister now"
  -> the active subject remains Pakistan.

No learning session is created for General Chat.

## Required environment

Keep your existing `.env` values and add:

JWT_SECRET=<a random secret of at least 32 characters>
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30

The real `.env` is intentionally not included in this ZIP.

## Build

npm install
npm run build

## Run

npm run dev
