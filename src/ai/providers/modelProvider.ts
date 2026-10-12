export interface ModelRequest {
  systemPrompt: string;
  userMessage: string;
  context?: unknown;

  responseSchema?: unknown;
}

export interface ModelResponse {
  text: string;
  provider: string;
  model: string;
}

export interface ModelProvider {
  generateResponse(
    request: ModelRequest
  ): Promise<ModelResponse>;
}