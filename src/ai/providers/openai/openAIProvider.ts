import OpenAI from "openai";
import {
  ModelProvider,
  ModelRequest,
  ModelResponse,
} from "../modelProvider";

export class OpenAIProvider implements ModelProvider {
  private client: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY is not configured"
      );
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateResponse(
    request: ModelRequest
  ): Promise<ModelResponse> {
    const response = await this.client.responses.create({
      model: "gpt-5",
      instructions: request.systemPrompt,
      input: request.userMessage,
    });

    return {
      text: response.output_text,
      provider: "openai",
      model: "gpt-5",
    };
  }
}