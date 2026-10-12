import { ModelProvider, ModelRequest, ModelResponse } from "../providers/modelProvider";

export type ModelProviderName = "openai" | "gemini" | "groq" | "llama";

export interface ModelRouter {
  route(provider: ModelProviderName, request: ModelRequest): Promise<ModelResponse>;
  isConfigured(provider: ModelProviderName): boolean;
  getConfiguredProviders(): ModelProviderName[];
}

export function createModelRouter(providers: Partial<Record<ModelProviderName, ModelProvider>>): ModelRouter {
  return {
    async route(provider, request) {
      const selectedProvider = providers[provider];
      if (!selectedProvider) throw new Error(`AI provider "${provider}" is not configured`);
      return selectedProvider.generateResponse(request);
    },
    isConfigured(provider) {
      return Boolean(providers[provider]);
    },
    getConfiguredProviders() {
      return (Object.keys(providers) as ModelProviderName[]).filter((name) => Boolean(providers[name]));
    },
  };
}
