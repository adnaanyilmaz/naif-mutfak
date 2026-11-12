// URL slugs per locale (admin.md §2): Turkish transliteration, Arabic → simple Latin transliteration.
const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

const AR_MAP: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'i', آ: 'a', ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h', خ: 'kh', د: 'd', ذ: 'dh',
  ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd', ط: 't', ظ: 'z', ع: 'a', غ: 'gh', ف: 'f', ق: 'q',
  ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', ة: 'a', و: 'w', ي: 'y', ى: 'a', ء: '', ئ: 'y', ؤ: 'w',
};

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 120;

export function slugify(input: string, locale: 'tr' | 'en' | 'ar'): string {
  let s = locale === 'tr' ? input.toLocaleLowerCase('tr-TR') : input.toLowerCase();
  s = [...s].map((ch) => (locale === 'ar' ? (AR_MAP[ch] ?? TR_MAP[ch] ?? ch) : (TR_MAP[ch] ?? ch))).join('');
  // Strip remaining diacritics (é → e), Arabic harakat/tatweel, then collapse to [a-z0-9-].
  s = s.normalize('NFKD').replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, '');
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s.slice(0, SLUG_MAX).replace(/-+$/, '');
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= SLUG_MAX && SLUG_PATTERN.test(slug);
}
