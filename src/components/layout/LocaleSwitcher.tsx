'use client';

import { useLocale, useTranslations } from 'next-intl';
import { LOCALE_META, LOCALES } from '@/i18n/config';
import { Link, usePathname } from '@/i18n/navigation';

const SHORT = { tr: 'TR', en: 'EN', ar: 'ع' } as const;

/** Segmented control; the full endonym is the accessible name. */
export function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher');
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t('label')}>
      <ul className="flex items-center gap-0.5 rounded-pill bg-linen p-1">
        {LOCALES.map((locale) => {
          const active = locale === current;
          return (
            <li key={locale}>
              <Link
                href={pathname}
                locale={locale}
                hrefLang={locale}
                lang={locale}
                dir={LOCALE_META[locale].dir}
                aria-label={LOCALE_META[locale].label}
                title={LOCALE_META[locale].label}
                aria-current={active ? 'true' : undefined}
                className={`flex h-10 min-w-10 md:h-8 items-center justify-center rounded-pill px-2.5 text-[0.8125rem] font-semibold transition-all duration-200 ${
                  active ? 'bg-white text-charcoal shadow-[0_1px_3px_rgb(0_0_0/0.12)]' : 'text-muted hover:text-charcoal'
                }`}
              >
                {SHORT[locale]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
