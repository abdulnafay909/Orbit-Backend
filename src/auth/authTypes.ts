import { Request } from "express";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  studentId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface TokenPayload {
  sub: string;
  type: "access" | "refresh";
  sessionId?: string;
}
