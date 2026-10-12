# ORBIT Backend — Phase 17 Authentication

Phase 17 adds real user accounts and account-owned data while preserving the existing ORBIT learning/AI architecture.

## Included

- PostgreSQL-backed users
- bcrypt password hashing
- JWT access tokens
- Rotating, database-backed refresh tokens
- Logout and logout-all
- `/api/auth/me`
- Authentication middleware
- User → student ownership
- Protected course/learning endpoints
- Persistent general-chat conversations and messages
- Chat list/messages endpoints for the drawer / Recent Chats UI
- Existing Gemini/Groq/OpenAI/learning functionality retained

## Authentication API

### Register

`POST /api/auth/register`

```json
{
  "name": "Nafay",
  "email": "nafay@example.com",
  "password": "a-secure-password"
}
```

### Login

`POST /api/auth/login`

```json
{
  "email": "nafay@example.com",
  "password": "a-secure-password"
}
```

Both return:

- `user`
- `accessToken`
- `refreshToken`

Send the access token on protected requests:

```text
Authorization: Bearer <accessToken>
```

### Refresh

`POST /api/auth/refresh`

```json
{
  "refreshToken": "<refreshToken>"
}
```

Refresh tokens are rotated. The previous refresh session is revoked when a new token is issued.

### Logout

`POST /api/auth/logout`

```json
{
  "refreshToken": "<refreshToken>"
}
```

### Current user

`GET /api/auth/me`

Requires the access token.

### Logout all devices

`POST /api/auth/logout-all`

Requires the access token.

## Database setup

The existing `src/db/schema.sql` is safe to run against the Phase 1-16 database. It creates the new Phase 17 tables and adds `students.user_id` while preserving the existing learning tables.

New tables:

- `users`
- `auth_sessions`
- `chat_conversations`
- `chat_messages`

Before starting the backend, add these values to `.env`:

```env
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
```

Do not commit the real `.env` file.

## General Chat

General Chat now requires authentication and is stored per account.

`POST /api/teacher/respond` with `GENERAL_TEACHER` returns a `conversationId`.

If the client sends a `conversationId`, ORBIT verifies that the conversation belongs to the authenticated user.

If no conversation ID is supplied, ORBIT uses the user's latest general conversation or creates one.

The standalone chat endpoints are:

- `GET /api/chats`
- `POST /api/chats`
- `GET /api/chats/:conversationId/messages`
- `POST /api/chats/:conversationId/messages`

## Security boundary

The client is never trusted to choose another user's `studentId`.

For protected learning endpoints, the backend verifies that the requested student belongs to the authenticated account. Learning-state creation uses the authenticated user's own student ID.

## Password reset

Email-based password reset is intentionally not activated yet because the project does not currently have an email delivery provider configured. The account/password system is ready for that next addition without storing plaintext passwords.

## Build

```powershell
npm run build
```

Start development:

```powershell
npm run dev
```
