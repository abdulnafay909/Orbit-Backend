import { ModelProvider } from "../providers/modelProvider";
import { OpenAIProvider } from "../providers/openai/openAIProvider";
import { GeminiProvider } from "../providers/gemini/geminiProvider";
import { GroqProvider } from "../providers/groq/groqProvider";
import { LlamaProvider } from "../providers/llama/llamaProvider";
import { ModelProviderName } from "./modelRouter";

export function createProviderRegistry(): Partial<Record<ModelProviderName, ModelProvider>> {
  const providers: Partial<Record<ModelProviderName, ModelProvider>> = {};

  if (process.env.GEMINI_API_KEY) providers.gemini = new GeminiProvider();
  if (process.env.GROQ_API_KEY) providers.groq = new GroqProvider();
  if (process.env.LLAMA_API_KEY) providers.llama = new LlamaProvider();
  if (process.env.OPENAI_API_KEY) providers.openai = new OpenAIProvider();

  return providers;
}
