// Prompt copy and body chunking for auto-translation (spec: docs/superpowers/specs/2026-11-16-auto-translation-design.md).
import type { AdminTranslation } from '@/repositories/admin-posts';
import type { ModelPayload, TargetLocale, TranslationCheck } from '@/validators/admin/translation';

export const BODY_CHUNK_CHARS = 12_000;
const REVIEW_BODY_CHARS = 8_000;

const LANG: Record<TargetLocale, string> = { en: 'English', ar: 'Modern Standard Arabic' };

interface Prompt {
  system: string;
  user: string;
}

/** Blocks separated by blank lines; a fenced code block or `:::` container stays one block. */
function blocks(md: string): string[] {
  const out: string[] = [];
  let open: string[] = [];
  let inFence = false;
  let depth = 0;
  for (const segment of md.split('\n\n')) {
    open.push(segment);
    for (const line of segment.split('\n')) {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      else if (!inFence && /^\s*:{3,}[a-zA-Z]/.test(line)) depth += 1;
      else if (!inFence && depth > 0 && /^\s*:{3,}\s*$/.test(line)) depth -= 1;
    }
    if (!inFence && depth === 0) {
      out.push(open.join('\n\n'));
      open = [];
    }
  }
  if (open.length > 0) out.push(open.join('\n\n'));
  return out;
}

/** Chunks of at most BODY_CHUNK_CHARS (an oversized block is its own chunk); `chunks.join('\n\n')` is the body. */
export function splitBody(bodyMd: string): string[] {
  if (!bodyMd.trim()) return [];
  if (bodyMd.length <= BODY_CHUNK_CHARS) return [bodyMd];
  const chunks: string[] = [];
  let current: string | null = null;
  for (const block of blocks(bodyMd)) {
    if (current !== null && current.length + 2 + block.length <= BODY_CHUNK_CHARS) {
      current = `${current}\n\n${block}`;
    } else {
      if (current !== null) chunks.push(current);
      current = block;
    }
  }
  if (current !== null) chunks.push(current);
  return chunks;
}

export function payloadPrompt(target: TargetLocale, payload: ModelPayload): Prompt {
  return {
    system: `You are a professional culinary translator. Translate Turkish recipe text into ${LANG[target]}. Return ONLY one JSON object with exactly the same keys, array lengths and "id" values as the input. Translate every string value except "id". Keep null as null. Do not add, remove, merge or reorder items. Use natural cooking vocabulary of the target language; translate units (e.g. "su bardağı" → the usual equivalent word) but never convert or change amounts. Keep dish names that have no established translation in their original form, transliterated for Arabic.`,
    user: JSON.stringify(payload),
  };
}

export function bodyPrompt(target: TargetLocale, chunk: string): Prompt {
  return {
    system: `You are a professional culinary translator. Translate the following Turkish Markdown into ${LANG[target]}. Output ONLY the translated Markdown. Keep every Markdown marker, heading level, list item, link URL, image URL and directive (lines or spans starting with ":" and anything inside "{...}") exactly as they are; translate only human-readable text. Never change numbers, temperatures or times.`,
    user: chunk,
  };
}

function reviewSide(t: AdminTranslation) {
  return {
    title: t.title,
    dek: t.dek,
    seoTitle: t.seoTitle,
    seoDescription: t.seoDescription,
    ingredients: (t.ingredients ?? []).flatMap((g) => g.items.map((i) => [i.id, i.name, i.unit ?? null, i.note ?? null])),
    steps: (t.instructions ?? []).flatMap((s) => s.steps.map((st) => [st.id, st.text])),
    bodyMd: t.bodyMd.slice(0, REVIEW_BODY_CHARS),
  };
}

export function reviewPrompt(target: TargetLocale, source: AdminTranslation, translated: AdminTranslation, checks: TranslationCheck[]): Prompt {
  return {
    system: `You are a meticulous bilingual recipe editor. Compare the Turkish source with its ${LANG[target]} translation. Report only real problems: missing or added information, wrong ingredient or technique terms, wrong units, changed numbers, unnatural or misleading wording. Return ONLY JSON: {"issues":[{"severity":"error"|"warning","field":"<field name or steps.<id> or ingredients.<id>>","message":"<one sentence, written in Turkish>"}]}. Return {"issues":[]} when the translation is good. At most 10 issues.`,
    user: JSON.stringify({ source: reviewSide(source), translation: reviewSide(translated), automatedChecks: checks }),
  };
}
