// Deterministic translation checks (free, exact): numbers, script, Markdown structure, untranslated text.
import type { AdminTranslation } from '@/repositories/admin-posts';
import type { CheckCode, TranslationCheck } from '@/validators/admin/translation';

const DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

/** Sorted numeric tokens; Arabic-Indic digits and decimal separators are normalised first. */
function numbers(text: string | null | undefined): string {
  const ascii = (text ?? '').replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d] ?? d).replace(/(\d)[,٫](\d)/g, '$1.$2');
  return (ascii.match(/\d+(?:\.\d+)?|[½¼¾⅓⅔]/g) ?? []).sort().join('|');
}

/** Text without link targets and directive attributes, so URLs do not count as letters. */
function prose(text: string): string {
  return text.replace(/\]\([^)]*\)/g, ']').replace(/\{[^}]*\}/g, '');
}

function wrongScript(locale: AdminTranslation['locale'], text: string | null | undefined): boolean {
  const letters = prose(text ?? '').match(/\p{L}/gu) ?? [];
  if (locale === 'ar') {
    if (letters.length < 4) return false;
    const arabic = letters.filter((l) => /\p{Script=Arabic}/u.test(l)).length;
    return arabic / letters.length < 0.6;
  }
  return letters.some((l) => /\p{Script=Arabic}/u.test(l));
}

const sorted = (xs: string[]) => [...xs].sort().join('\n');
const headings = (md: string) => sorted(md.match(/^#{1,6}(?=\s)/gm) ?? []);
const listItems = (md: string) => (md.match(/^\s*(?:[-*+]|\d+[.)])\s/gm) ?? []).length;
const links = (md: string) => sorted([...md.matchAll(/\]\(([^)\s]+)/g)].map((m) => m[1] ?? ''));
/** Leaf (`::name{…}`) and container (`:::name{…}`) directives; single-colon text directives are prose. */
const directives = (md: string) => sorted([...md.matchAll(/:{2,}([a-zA-Z][\w-]*)(\{[^}]*\})?/g)].map((m) => `${m[1]}${m[2] ?? ''}`));

const fold = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr');

const steps = (t: AdminTranslation) => (t.instructions ?? []).flatMap((s) => s.steps);
const items = (t: AdminTranslation) => (t.ingredients ?? []).flatMap((g) => g.items);

export function runChecks(source: AdminTranslation, target: AdminTranslation): TranslationCheck[] {
  const out: TranslationCheck[] = [];
  const add = (code: CheckCode, field: string) => out.push({ code, field });

  if (fold(source.title) === fold(target.title)) add('untranslated', 'title');
  const sourceSteps = new Map(steps(source).map((s) => [s.id, s.text]));
  const targetSteps = steps(target);
  const same = targetSteps.filter((s) => fold(s.text) === fold(sourceSteps.get(s.id) ?? '')).length;
  if (targetSteps.length > 0 && same > targetSteps.length / 2) add('untranslated', 'instructions');

  for (const field of ['title', 'dek', 'bodyMd'] as const) {
    if (wrongScript(target.locale, target[field])) add('wrong_script', field);
  }
  for (const s of targetSteps) if (wrongScript(target.locale, s.text)) add('wrong_script', `steps.${s.id}`);

  if (numbers(source.bodyMd) !== numbers(target.bodyMd)) add('numbers', 'bodyMd');
  for (const s of targetSteps) {
    if (numbers(sourceSteps.get(s.id)) !== numbers(s.text)) add('numbers', `steps.${s.id}`);
  }
  const sourceNotes = new Map(items(source).map((i) => [i.id, i.note]));
  for (const i of items(target)) {
    if (numbers(sourceNotes.get(i.id)) !== numbers(i.note)) add('numbers', `ingredients.${i.id}`);
  }

  if (headings(source.bodyMd) !== headings(target.bodyMd)) add('body_headings', 'bodyMd');
  if (listItems(source.bodyMd) !== listItems(target.bodyMd)) add('body_lists', 'bodyMd');
  if (links(source.bodyMd) !== links(target.bodyMd)) add('body_links', 'bodyMd');
  if (directives(source.bodyMd) !== directives(target.bodyMd)) add('body_directives', 'bodyMd');

  return out;
}
