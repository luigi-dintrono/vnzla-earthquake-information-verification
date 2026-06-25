import OpenAI from "openai";
import { env, hasOpenAI, EMBEDDING_DIM } from "@/lib/env";

let client: OpenAI | null = null;

function openai(): OpenAI | null {
  if (!hasOpenAI()) return null;
  if (!client) client = new OpenAI({ apiKey: env.openaiKey });
  return client;
}

/**
 * Embed text for semantic dedup. Returns null when no OpenAI key is set (the
 * pipeline then falls back to Postgres trigram similarity) or on API error.
 */
export async function embed(text: string): Promise<number[] | null> {
  const c = openai();
  if (!c) return null;
  try {
    const res = await c.embeddings.create({
      model: env.embeddingModel,
      input: text.slice(0, 8000),
      dimensions: EMBEDDING_DIM,
    });
    return res.data[0]?.embedding ?? null;
  } catch (e) {
    console.warn("[embed] failed, falling back to trigram:", (e as Error).message);
    return null;
  }
}
