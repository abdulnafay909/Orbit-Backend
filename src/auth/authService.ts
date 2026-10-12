import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { randomUUID } from "crypto";
import { pool, withTransaction } from "../db/database";
import { AuthenticatedUser, TokenPayload } from "./authTypes";

const ACCESS_TOKEN_EXPIRES =
  process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_DAYS = Number(
  process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30
);

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be configured and contain at least 32 characters"
    );
  }
  return secret;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function publicUser(row: {
  id: string;
  email: string;
  name: string;
  student_id: string;
}): AuthenticatedUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    studentId: row.student_id,
  };
}

function signAccessToken(user: AuthenticatedUser): string {
  const payload: TokenPayload = {
    sub: user.id,
    type: "access",
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRES as SignOptions["expiresIn"],
  });
}

async function createRefreshToken(
  userId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<string> {
  const rawToken = randomUUID() + "." + randomUUID();
  const tokenHash = await bcrypt.hash(rawToken, 10);
  const sessionId = randomUUID();
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
  );

  await pool.query(
    `INSERT INTO auth_sessions
      (id, user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      sessionId,
      userId,
      tokenHash,
      expiresAt,
      userAgent?.slice(0, 500) ?? null,
      ipAddress?.slice(0, 100) ?? null,
    ]
  );

  return `${sessionId}.${rawToken}`;
}

export async function registerUser(params: {
  name: string;
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<{
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}> {
  const name = params.name.trim();
  const email = normalizeEmail(params.email);

  if (name.length < 2 || name.length > 100) {
    throw new Error("Name must be between 2 and 100 characters");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please provide a valid email address");
  }

  if (params.password.length < 8 || params.password.length > 128) {
    throw new Error("Password must be between 8 and 128 characters");
  }

  const passwordHash = await bcrypt.hash(params.password, 12);
  const userId = randomUUID();
  const studentId = randomUUID();

  const user = await withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );

    if (existing.rowCount) {
      throw new Error("An account with this email already exists");
    }

    await client.query(
      `INSERT INTO users (id, email, password_hash, name)
       VALUES ($1,$2,$3,$4)`,
      [userId, email, passwordHash, name]
    );

    await client.query(
      `INSERT INTO students (id, user_id)
       VALUES ($1,$2)`,
      [studentId, userId]
    );

    const result = await client.query(
      `SELECT u.id, u.email, u.name, s.id AS student_id
       FROM users u
       JOIN students s ON s.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    return publicUser(result.rows[0]);
  });

  const accessToken = signAccessToken(user);
  const refreshToken = await createRefreshToken(
    user.id,
    params.userAgent,
    params.ipAddress
  );

  return { user, accessToken, refreshToken };
}

export async function loginUser(params: {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<{
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}> {
  const email = normalizeEmail(params.email);

  const result = await pool.query(
    `SELECT u.id, u.email, u.name, u.password_hash, s.id AS student_id
     FROM users u
     JOIN students s ON s.user_id = u.id
     WHERE u.email = $1 AND u.is_active = TRUE
     LIMIT 1`,
    [email]
  );

  if (!result.rowCount) {
    throw new Error("Invalid email or password");
  }

  const row = result.rows[0];
  const valid = await bcrypt.compare(params.password, row.password_hash);

  if (!valid) {
    throw new Error("Invalid email or password");
  }

  await pool.query(
    `UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [row.id]
  );

  const user = publicUser(row);
  const accessToken = signAccessToken(user);
  const refreshToken = await createRefreshToken(
    user.id,
    params.userAgent,
    params.ipAddress
  );

  return { user, accessToken, refreshToken };
}

export async function verifyAccessToken(
  token: string
): Promise<AuthenticatedUser> {
  const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;

  if (decoded.type !== "access" || !decoded.sub) {
    throw new Error("Invalid access token");
  }

  const result = await pool.query(
    `SELECT u.id, u.email, u.name, s.id AS student_id
     FROM users u
     JOIN students s ON s.user_id = u.id
     WHERE u.id = $1 AND u.is_active = TRUE
     LIMIT 1`,
    [decoded.sub]
  );

  if (!result.rowCount) {
    throw new Error("User account not found");
  }

  return publicUser(result.rows[0]);
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}> {
  const separator = refreshToken.indexOf(".");
  if (separator <= 0) {
    throw new Error("Invalid refresh token");
  }

  const sessionId = refreshToken.slice(0, separator);
  const rawToken = refreshToken.slice(separator + 1);

  const result = await pool.query(
    `SELECT
       s.id AS session_id,
       s.user_id,
       s.token_hash,
       s.expires_at,
       u.email,
       u.name,
       st.id AS student_id
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     JOIN students st ON st.user_id = u.id
     WHERE s.id = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW()
       AND u.is_active = TRUE
     LIMIT 1`,
    [sessionId]
  );

  if (!result.rowCount) {
    throw new Error("Refresh session is invalid or expired");
  }

  const row = result.rows[0];
  const valid = await bcrypt.compare(rawToken, row.token_hash);

  if (!valid) {
    await pool.query(
      `UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1`,
      [sessionId]
    );
    throw new Error("Refresh session is invalid");
  }

  const user: AuthenticatedUser = {
    id: row.user_id,
    email: row.email,
    name: row.name,
    studentId: row.student_id,
  };

  // Rotate the refresh token so a stolen token cannot be reused indefinitely.
  await pool.query(
    `UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1`,
    [sessionId]
  );

  const accessToken = signAccessToken(user);
  const newRefreshToken = await createRefreshToken(user.id);

  return {
    user,
    accessToken,
    refreshToken: newRefreshToken,
  };
}

export async function logoutUser(refreshToken?: string): Promise<void> {
  if (!refreshToken) return;

  const separator = refreshToken.indexOf(".");
  if (separator <= 0) return;

  const sessionId = refreshToken.slice(0, separator);

  await pool.query(
    `UPDATE auth_sessions
     SET revoked_at = NOW()
     WHERE id = $1`,
    [sessionId]
  );
}

export async function logoutAllSessions(userId: string): Promise<void> {
  await pool.query(
    `UPDATE auth_sessions SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

export async function getUserById(
  userId: string
): Promise<AuthenticatedUser | undefined> {
  const result = await pool.query(
    `SELECT u.id, u.email, u.name, s.id AS student_id
     FROM users u
     JOIN students s ON s.user_id = u.id
     WHERE u.id = $1 AND u.is_active = TRUE
     LIMIT 1`,
    [userId]
  );

  return result.rowCount ? publicUser(result.rows[0]) : undefined;
}

export async function assertStudentOwnership(
  userId: string,
  studentId: string
): Promise<boolean> {
  // ORBIT supports separate learning paths per course. A course-scoped ID is
  // bound to the authenticated account ID, so it cannot be used to address a
  // different account's learning state. The course slug is deliberately
  // restricted to safe ID characters.
  const courseScopedPrefix = `orbit-student-${userId}-course-`;
  if (studentId.startsWith(courseScopedPrefix)) {
    const courseId = studentId.slice(courseScopedPrefix.length);
    if (/^[a-zA-Z0-9_-]{1,160}$/.test(courseId)) return true;
  }

  const result = await pool.query(
    `SELECT 1
     FROM students
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [studentId, userId]
  );

  return Boolean(result.rowCount);
}
