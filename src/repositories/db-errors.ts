/** D1 surfaces SQLite constraint errors as messages (possibly wrapped in `cause`). */
function messages(err: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur instanceof Error && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur.message);
    cur = cur.cause;
  }
  return out;
}

export function isUniqueViolation(err: unknown, table: string): boolean {
  return messages(err).some((m) => m.includes('UNIQUE constraint failed') && m.includes(table));
}

export function isForeignKeyViolation(err: unknown): boolean {
  return messages(err).some((m) => m.includes('FOREIGN KEY constraint failed'));
}

/** Optimistic-concurrency guards abort a batch via `json('conflict')` (see guardUpdatedAt). */
export function isGuardViolation(err: unknown): boolean {
  return messages(err).some((m) => m.includes('malformed JSON'));
}
