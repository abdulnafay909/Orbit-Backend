import {
  ModelProvider,
  ModelRequest,
  ModelResponse,
} from "../modelProvider";

export class GroqProvider implements ModelProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY ?? "";

    this.model =
      process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

    this.baseUrl =
      process.env.GROQ_API_URL ??
      "https://api.groq.com/openai/v1/chat/completions";
  }

  async generateResponse(
    request: ModelRequest
  ): Promise<ModelResponse> {
    if (!this.apiKey) {
      throw new Error("GROQ_API_KEY is not configured");
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

    const body: Record<string, unknown> = {
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
    };

    const response = await fetch(this.baseUrl, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },

      body: JSON.stringify(body),
    });

    const payload: any = await response.json();

    if (!response.ok) {
      throw new Error(
        `Groq ${response.status}: ${
          payload?.error?.message ?? "request failed"
        }`
      );
    }

    const text =
      payload?.choices?.[0]?.message?.content ?? "";

    if (!text) {
      throw new Error(
        "Groq returned an empty response"
      );
    }

    return {
      text,
      provider: "groq",
      model: this.model,
    };
  }
}