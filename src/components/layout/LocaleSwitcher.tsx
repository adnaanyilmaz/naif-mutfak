'use client';

import { useLocale, useTranslations } from 'next-intl';
import { LOCALE_META, LOCALES } from '@/i18n/config';
import { Link, usePathname } from '@/i18n/navigation';

export function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher');
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t('label')}>
      <ul className="flex items-center gap-3 text-ui">
        {LOCALES.map((locale, i) => (
          <li key={locale} className="flex items-center gap-3">
            {i > 0 && (
              <span aria-hidden className="text-muted">
                ·
              </span>
            )}
            <Link
              href={pathname}
              locale={locale}
              hrefLang={locale}
              lang={locale}
              dir={LOCALE_META[locale].dir}
              aria-current={locale === current ? 'true' : undefined}
              className={locale === current ? 'font-semibold text-charcoal' : 'text-stone hover:text-terracotta'}
            >
              {LOCALE_META[locale].label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
