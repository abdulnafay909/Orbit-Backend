# ORBIT Phase 17 Complete Backend

Includes real PostgreSQL-backed authentication, JWT access tokens, refresh-token sessions, protected APIs, user/student ownership checks, persistent user-owned chat conversations, and General Chat context/history improvements.

## Required .env

Keep your existing provider/database settings and add:

JWT_SECRET=<at least 32 random characters>
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30

Do not commit or share the real `.env`.
