import { getTranslations } from 'next-intl/server';
import { findCategory } from '@/services/content/category';
import type { Locale } from '@/validators/content';
import { routing } from './routing';

/**
 * Label lookup for stored category values. A locale whose label is still empty
 * (translation pending) falls back to the default-locale label; unknown values yield null.
 */
export async function getCategoryLabeler(locale: Locale): Promise<(category: string) => string | null> {
  const [t, fallback] = await Promise.all([
    getTranslations({ locale, namespace: 'Categories' }),
    getTranslations({ locale: routing.defaultLocale, namespace: 'Categories' }),
  ]);
  return (category) => {
    const key = findCategory(category);
    if (!key) return null;
    return t(key) || fallback(key);
  };
}
