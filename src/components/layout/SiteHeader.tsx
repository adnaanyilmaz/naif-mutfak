import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './LocaleSwitcher';

const NAV = [
  { href: '/recipes', key: 'recipes' },
  { href: '/ebooks', key: 'ebooks' },
  { href: '/about', key: 'about' },
] as const;

export async function SiteHeader() {
  const t = await getTranslations('Header');
  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex max-w-page items-center justify-between gap-6 px-6 py-5">
        <Link href="/" className="font-display text-h3 font-semibold tracking-tight" aria-label={t('home')}>
          Naif Mutfak
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex gap-8 text-ui">
            {NAV.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className="hover:text-terracotta">
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <LocaleSwitcher />
      </div>
    </header>
  );
}
