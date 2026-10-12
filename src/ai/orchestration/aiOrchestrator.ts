import {
  ModelRequest,
  ModelResponse,
} from "../providers/modelProvider";
import {
  ModelProviderName,
  ModelRouter,
} from "../router/modelRouter";
import { limitAIContext } from "./aiContext";
import {
  classifyAIError,
  getAIReliabilityConfig,
  getErrorMessage,
  shouldRetryProvider,
  withAITimeout,
} from "./aiReliability";

export interface AIOrchestrationRequest
  extends ModelRequest {
  operation?: string;
  preferredProvider?: ModelProviderName;
  fallbackProviders?: ModelProviderName[];
  expectJson?: boolean;
}

export interface AIOrchestrationResult
  extends ModelResponse {
  attempts: number;
  attemptedProviders: string[];
  durationMs: number;
}

export interface AIOrchestrator {
  generate(
    request: AIOrchestrationRequest
  ): Promise<AIOrchestrationResult>;
}

const DEFAULT_ORDER: ModelProviderName[] = [
  "gemini",
  "groq",
  "llama",
  "openai",
];

const VALID_PROVIDERS = new Set<ModelProviderName>([
  "openai",
  "gemini",
  "groq",
  "llama",
]);

function uniqueProviders(
  values: ModelProviderName[]
): ModelProviderName[] {
  return [...new Set(values)];
}

function configuredProviders(
  router: ModelRouter
): ModelProviderName[] {
  return DEFAULT_ORDER.filter((name) =>
    router.isConfigured(name)
  );
}

function parseProviderList(
  value: string | undefined
): ModelProviderName[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(
      (item): item is ModelProviderName =>
        VALID_PROVIDERS.has(
          item as ModelProviderName
        )
    );
}

function isJsonText(text: string): boolean {
  if (!text || !text.trim()) {
    return false;
  }

  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function withJsonRecoveryPrompt(
  request: AIOrchestrationRequest
): AIOrchestrationRequest {
  return {
    ...request,
    systemPrompt: `${request.systemPrompt}

RELIABILITY REQUIREMENT:
Return ONLY valid JSON matching the requested structure.
Do not use markdown fences.
Do not add commentary before or after the JSON.`,
  };
}

function createContextSafeRequest(
  request: AIOrchestrationRequest
): AIOrchestrationRequest {
  return {
    ...request,
    context: limitAIContext(request.context),
  };
}

export function createAIOrchestrator(
  modelRouter: ModelRouter
): AIOrchestrator {
  return {
    async generate(
      request: AIOrchestrationRequest
    ): Promise<AIOrchestrationResult> {
      const startedAt = Date.now();

      const envPrimary =
        process.env.AI_PRIMARY_PROVIDER
          ?.trim()
          .toLowerCase() as
          | ModelProviderName
          | undefined;

      const envFallbacks =
        parseProviderList(
          process.env.AI_FALLBACK_PROVIDERS
        );

      const configured =
        configuredProviders(modelRouter);

      const preferred =
        request.preferredProvider ??
        envPrimary;

      const fallback =
        request.fallbackProviders ??
        envFallbacks;

      const candidates = uniqueProviders([
        ...(preferred ? [preferred] : []),
        ...fallback,
        ...configured,
      ]).filter((provider) =>
        modelRouter.isConfigured(provider)
      );

      if (candidates.length === 0) {
        throw new Error(
          "No configured AI provider is available"
        );
      }

      const safeRequest =
        createContextSafeRequest(request);

      const attemptedProviders: string[] = [];
      const errors: string[] = [];
      let attempts = 0;

      const reliability =
        getAIReliabilityConfig();

      for (const provider of candidates) {
        attemptedProviders.push(provider);

        const providerRetries = 0;

        for (
          let retryIndex = 0;
          retryIndex <= providerRetries;
          retryIndex += 1
        ) {
          try {
            attempts += 1;

            let response =
              await withAITimeout(
                modelRouter.route(
                  provider,
                  safeRequest
                ),
                reliability.timeoutMs
              );

            if (
              !response ||
              typeof response.text !== "string" ||
              !response.text.trim()
            ) {
              throw new Error(
                "Provider returned an empty response"
              );
            }

            if (
              request.expectJson &&
              !isJsonText(response.text)
            ) {
              let recovered = false;

              for (
                let recoveryAttempt = 1;
                recoveryAttempt <=
                reliability.jsonRecoveryAttempts;
                recoveryAttempt += 1
              ) {
                attempts += 1;

                response =
                  await withAITimeout(
                    modelRouter.route(
                      provider,
                      withJsonRecoveryPrompt(
                        safeRequest
                      )
                    ),
                    reliability.timeoutMs
                  );

                if (
                  response &&
                  typeof response.text ===
                    "string" &&
                  isJsonText(response.text)
                ) {
                  recovered = true;
                  break;
                }
              }

              if (!recovered) {
                throw new Error(
                  "Provider returned invalid JSON after recovery"
                );
              }
            }

            return {
              ...response,
              attempts,
              attemptedProviders,
              durationMs:
                Date.now() - startedAt,
            };
          } catch (error: unknown) {
            const category =
              classifyAIError(error);
            const message =
              getErrorMessage(error);

            errors.push(
              `${provider} [${category}]: ${message}`
            );

            console.warn(
              `AI orchestration provider failed (${provider}) [${category}]: ${message}`
            );

            if (
              shouldRetryProvider(
                category,
                retryIndex,
                providerRetries
              )
            ) {
              continue;
            }

            break;
          }
        }
      }

      throw new Error(
        `All configured AI providers failed. ${errors.join(
          " | "
        )}`
      );
    },
  };
}
