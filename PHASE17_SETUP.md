# ORBIT Phase 17 — Installation

## 1. Copy the project

Replace your backend source with the files in this archive, but keep your real `.env` file safe.

The archive intentionally does NOT contain the real `.env` file.

## 2. Environment

Open `backend/.env` and add:

```env
JWT_SECRET=YOUR_LONG_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
```

Keep all existing Gemini, Groq, database, and provider variables.

Do not commit `.env`.

## 3. Install dependencies

The supplied `package.json` and `package-lock.json` already include:

- bcryptjs
- jsonwebtoken
- @types/jsonwebtoken

Run:

```powershell
npm install
```

## 4. Start

```powershell
npm run dev
```

On startup ORBIT checks the PostgreSQL connection and automatically applies `src/db/schema.sql`.

You should see:

```text
PostgreSQL connection established
ORBIT database schema is ready
ORBIT backend running on port 5000
```

## 5. Authentication endpoints

- POST `/api/auth/register`
- POST `/api/auth/login`
- POST `/api/auth/refresh`
- POST `/api/auth/logout`
- GET `/api/auth/me`
- POST `/api/auth/logout-all`

## 6. Protected ORBIT data

Learning endpoints and General Chat now require:

```text
Authorization: Bearer <accessToken>
```

The backend verifies that the authenticated account owns its student record before allowing course-state access.

## 7. General Chat persistence

General Chat is stored per authenticated account.

The drawer can use:

- GET `/api/chats`
- POST `/api/chats`
- GET `/api/chats/:conversationId/messages`
- POST `/api/chats/:conversationId/messages`

`/api/teacher/respond` returns `conversationId` for General Chat.

## 8. Password reset

Email password reset is not enabled yet because no email delivery provider is configured. Passwords are still securely hashed with bcrypt and never stored in plaintext.

## Important

Existing learning sessions that were created with old demo student IDs are not automatically attached to a new account. New authenticated learning sessions are automatically created under the logged-in user's student ID. This prevents one account from accessing another account's learning data.
