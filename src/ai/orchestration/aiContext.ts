export interface AIContextLimits {
  maxContextCharacters: number;
  maxArrayItems: number;
  maxStringCharacters: number;
}

const DEFAULT_MAX_CONTEXT_CHARACTERS = 24_000;
const DEFAULT_MAX_ARRAY_ITEMS = 20;
const DEFAULT_MAX_STRING_CHARACTERS = 4_000;

function readPositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : fallback;
}

export function getAIContextLimits(): AIContextLimits {
  return {
    maxContextCharacters: readPositiveInteger(
      process.env.AI_MAX_CONTEXT_CHARS,
      DEFAULT_MAX_CONTEXT_CHARACTERS
    ),
    maxArrayItems: readPositiveInteger(
      process.env.AI_MAX_CONTEXT_ARRAY_ITEMS,
      DEFAULT_MAX_ARRAY_ITEMS
    ),
    maxStringCharacters: readPositiveInteger(
      process.env.AI_MAX_CONTEXT_STRING_CHARS,
      DEFAULT_MAX_STRING_CHARACTERS
    ),
  };
}

function trimString(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max)}…[truncated]`;
}

function sanitizeValue(
  value: unknown,
  limits: AIContextLimits,
  depth = 0
): unknown {
  if (typeof value === "string") {
    return trimString(value, limits.maxStringCharacters);
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (depth > 8) {
    return "[context depth limit reached]";
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(-limits.maxArrayItems)
      .map((item) =>
        sanitizeValue(item, limits, depth + 1)
      );

    if (value.length > limits.maxArrayItems) {
      return [
        "[earlier items omitted]",
        ...items,
      ];
    }

    return items;
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(
      value as Record<string, unknown>
    )) {
      result[key] = sanitizeValue(
        child,
        limits,
        depth + 1
      );
    }

    return result;
  }

  return String(value);
}

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

function compactKnownContext(
  value: Record<string, unknown>,
  limits: AIContextLimits
): Record<string, unknown> {
  const preferredKeys = [
    "mode",
    "student",
    "course",
    "domainProfile",
    "goal",
    "preferences",
    "existingKnowledge",
    "constraints",
    "outcome",
    "currentTask",
    "skills",
    "progress",
    "adaptiveGuidance",
    "conversationHistory",
    "recentLearningHistory",
  ];

  const compact: Record<string, unknown> = {};

  for (const key of preferredKeys) {
    if (key in value) {
      compact[key] = sanitizeValue(
        value[key],
        limits
      );
    }
  }

  return compact;
}

/**
 * Protects the model request from unbounded context growth while preserving
 * the learning information that matters most.
 *
 * The current TeacherContext already limits conversation/history to recent
 * entries. This helper is an additional final safety boundary at the
 * orchestration layer.
 */
export function limitAIContext(
  context: unknown
): unknown {
  if (context === undefined) {
    return undefined;
  }

  const limits = getAIContextLimits();
  const sanitized = sanitizeValue(
    context,
    limits
  );

  if (
    typeof sanitized !== "object" ||
    sanitized === null ||
    Array.isArray(sanitized)
  ) {
    const serialized = serialize(sanitized);

    if (
      serialized.length <=
      limits.maxContextCharacters
    ) {
      return sanitized;
    }

    return trimString(
      serialized,
      limits.maxContextCharacters
    );
  }

  let candidate =
    sanitized as Record<string, unknown>;

  let serialized = serialize(candidate);

  if (
    serialized.length <=
    limits.maxContextCharacters
  ) {
    return candidate;
  }

  candidate = compactKnownContext(
    candidate,
    limits
  );

  serialized = serialize(candidate);

  if (
    serialized.length <=
    limits.maxContextCharacters
  ) {
    return candidate;
  }

  /**
   * Last-resort protection. Keep the highest-value fields and trim
   * conversation/history aggressively instead of sending an oversized
   * request. This is intentionally conservative and does not invent
   * summaries.
   */
  const reduced: Record<string, unknown> = {};

  for (const key of [
    "mode",
    "student",
    "course",
    "domainProfile",
    "goal",
    "outcome",
    "currentTask",
    "progress",
    "skills",
    "preferences",
    "existingKnowledge",
    "constraints",
  ]) {
    if (key in candidate) {
      reduced[key] = candidate[key];
    }
  }

  const reducedSerialized = serialize(reduced);

  if (
    reducedSerialized.length <=
    limits.maxContextCharacters
  ) {
    return reduced;
  }

  return trimString(
    reducedSerialized,
    limits.maxContextCharacters
  );
}
