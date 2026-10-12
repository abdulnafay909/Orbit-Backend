import { Router } from "express";
import {
  getUserById,
  loginUser,
  logoutAllSessions,
  logoutUser,
  refreshAccessToken,
  registerUser,
} from "./authService";
import { requireAuth } from "./authMiddleware";
import { AuthenticatedRequest } from "./authTypes";

export const authRouter = Router();

function requestMetadata(req: AuthenticatedRequest) {
  const forwarded = req.headers["x-forwarded-for"];
  const ipAddress =
    typeof forwarded === "string"
      ? forwarded.split(",")[0].trim()
      : req.ip;

  return {
    userAgent: req.headers["user-agent"],
    ipAddress,
  };
}

authRouter.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body ?? {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    const result = await registerUser({
      name,
      email,
      password,
      ...requestMetadata(req as AuthenticatedRequest),
    });

    return res.status(201).json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration failed";

    const status =
      message.includes("already exists") ? 409 : 400;

    return res.status(status).json({
      success: false,
      message,
    });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await loginUser({
      email,
      password,
      ...requestMetadata(req as AuthenticatedRequest),
    });

    return res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }
});

authRouter.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body ?? {};

    if (typeof refreshToken !== "string" || !refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    const result = await refreshAccessToken(refreshToken);

    return res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token",
    });
  }
});

authRouter.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body ?? {};
    await logoutUser(
      typeof refreshToken === "string" ? refreshToken : undefined
    );

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
});

authRouter.get(
  "/me",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const user = req.user
      ? await getUserById(req.user.id)
      : undefined;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found",
      });
    }

    return res.json({
      success: true,
      user,
    });
  }
);

authRouter.post(
  "/logout-all",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    await logoutAllSessions(req.user.id);

    return res.json({
      success: true,
      message: "All sessions have been logged out",
    });
  }
);
