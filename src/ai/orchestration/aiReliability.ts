export type AIErrorCategory =
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "TEMPORARY_PROVIDER_ERROR"
  | "AUTHENTICATION"
  | "CONFIGURATION"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

export interface AIReliabilityConfig {
  timeoutMs: number;
  jsonRecoveryAttempts: number;
}

export interface AIProviderFailure {
  provider: string;
  category: AIErrorCategory;
  message: string;
  durationMs: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_JSON_RECOVERY_ATTEMPTS = 1;

function readPositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : fallback;
}

export function getAIReliabilityConfig(): AIReliabilityConfig {
  return {
    timeoutMs: readPositiveInteger(
      process.env.AI_PROVIDER_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS
    ),
    jsonRecoveryAttempts: readPositiveInteger(
      process.env.AI_JSON_RECOVERY_ATTEMPTS,
      DEFAULT_JSON_RECOVERY_ATTEMPTS
    ),
  };
}

export function classifyAIError(error: unknown): AIErrorCategory {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error ?? "").toLowerCase();

  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("aborted")
  ) {
    return "TIMEOUT";
  }

  if (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return "RATE_LIMIT";
  }

  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("api key")
  ) {
    return "AUTHENTICATION";
  }

  if (
    message.includes("not configured") ||
    message.includes("configuration") ||
    message.includes("no configured")
  ) {
    return "CONFIGURATION";
  }

  if (
    message.includes("invalid json") ||
    message.includes("empty response") ||
    message.includes("invalid response")
  ) {
    return "INVALID_RESPONSE";
  }

  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("temporarily unavailable") ||
    message.includes("service unavailable")
  ) {
    return "TEMPORARY_PROVIDER_ERROR";
  }

  return "UNKNOWN";
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown AI provider error";
}

export async function withAITimeout<T>(
  operation: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`AI provider timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Deliberately conservative retry policy.
 *
 * Providers already have their own SDK-specific retry behavior where
 * appropriate. The orchestrator should prefer switching providers instead
 * of multiplying paid API calls. JSON recovery is handled separately.
 */
export function shouldRetryProvider(
  category: AIErrorCategory,
  retryIndex: number,
  maxRetries: number
): boolean {
  if (retryIndex >= maxRetries) {
    return false;
  }

  return (
    category === "TIMEOUT" ||
    category === "TEMPORARY_PROVIDER_ERROR"
  );
}

export function toSafeAIErrorMessage(
  operation?: string
): string {
  const normalizedOperation = operation?.trim();

  if (normalizedOperation === "teacher-response") {
    return "I'm having trouble responding right now. Please try again in a moment.";
  }

  if (normalizedOperation === "learning-path-generation") {
    return "I'm having trouble preparing your learning path right now. Please try again in a moment.";
  }

  return "I'm having trouble processing your AI request right now. Please try again in a moment.";
}
