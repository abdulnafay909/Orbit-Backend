import {
  ModelProvider,
  ModelRequest,
  ModelResponse,
} from "../modelProvider";

export class LlamaProvider implements ModelProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.LLAMA_API_KEY ?? "";

    this.model =
      process.env.LLAMA_MODEL ??
      "meta-llama/llama-3.3-70b-instruct";

    this.baseUrl =
      process.env.LLAMA_API_URL ??
      "https://openrouter.ai/api/v1/chat/completions";
  }

  async generateResponse(
    request: ModelRequest
  ): Promise<ModelResponse> {
    if (!this.apiKey) {
      throw new Error("LLAMA_API_KEY is not configured");
    }

    const systemPrompt = `${request.systemPrompt}

IMPORTANT OUTPUT REQUIREMENT:
Return your response as valid JSON.
The response must contain JSON only.
Do not use markdown code fences.
Do not add explanations outside the JSON object.`;

    const userMessage =
      request.userMessage +
      (request.context
        ? `\n\nSTUDENT LEARNING CONTEXT:\n${JSON.stringify(
            request.context
          )}`
        : "");

    const response = await fetch(this.baseUrl, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(process.env.LLAMA_APP_URL
          ? {
              "HTTP-Referer": process.env.LLAMA_APP_URL,
            }
          : {}),
        ...(process.env.LLAMA_APP_NAME
          ? {
              "X-Title": process.env.LLAMA_APP_NAME,
            }
          : {}),
      },

      body: JSON.stringify({
        model: this.model,

        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],

        temperature: 0.2,

        response_format: {
          type: "json_object",
        },
      }),
    });

    const payload: any = await response.json();

    if (!response.ok) {
      throw new Error(
        `Llama ${response.status}: ${
          payload?.error?.message ?? "request failed"
        }`
      );
    }

    const text =
      payload?.choices?.[0]?.message?.content ?? "";

    if (!text) {
      throw new Error("Llama returned an empty response");
    }

    return {
      text,
      provider: "llama",
      model: this.model,
    };
  }
}