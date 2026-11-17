// Parsing raw Workers AI text-generation responses. Pure: no bindings, no I/O.
import { z } from 'zod';

const chatShape = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) });
const legacyShape = z.object({ response: z.unknown() });

/** Text of the first completion, for both the chat-completions and the legacy `{ response }` shapes. */
export function extractModelText(raw: unknown): string | null {
  const chat = chatShape.safeParse(raw);
  if (chat.success) return chat.data.choices[0]?.message.content ?? null;
  const legacy = legacyShape.safeParse(raw);
  if (!legacy.success || legacy.data.response === undefined || legacy.data.response === null) return null;
  const r = legacy.data.response;
  return typeof r === 'string' ? r : JSON.stringify(r);
}

/** The JSON object in a model reply (tolerates prose and code fences around it), or null. */
export function parseModelJson(raw: unknown): unknown {
  const text = extractModelText(raw);
  if (text === null) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const FENCED = /^\s*```[\w-]*\n([\s\S]*?)\n```\s*$/;

/** Removes one fence wrapping the whole reply (models sometimes fence Markdown output). */
export function stripFence(text: string): string {
  const m = FENCED.exec(text);
  return m?.[1] ?? text;
}

/** Daily free allocation (3036; older 4006) vs. anything else. Capacity (3040) is also HTTP 429, so it is checked first. */
export function classifyAiError(err: unknown): 'quota' | 'ai_unavailable' {
  const message = err instanceof Error ? err.message : String(err);
  if (/\b3040\b|capacity/i.test(message)) return 'ai_unavailable';
  return /\b(3036|4006|429)\b|daily|allocation|neurons?/i.test(message) ? 'quota' : 'ai_unavailable';
}
