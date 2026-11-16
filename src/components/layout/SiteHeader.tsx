import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './LocaleSwitcher';
import { Logo } from './Logo';

const NAV = [
  { href: '/blog', key: 'recipes' },
  { href: '/ebooks', key: 'ebooks' },
  { href: '/about', key: 'about' },
] as const;

export async function SiteHeader() {
  const t = await getTranslations('Header');
  const links = NAV.map((item) => (
    <li key={item.key}>
      <Link
        href={item.href}
        className="inline-flex min-h-10 items-center rounded-pill px-4 text-ui font-medium text-stone transition-colors duration-200 hover:bg-linen hover:text-charcoal"
      >
        {t(item.key)}
      </Link>
    </li>
  ));

  return (
    <header className="sticky top-0 z-40 border-b border-hairline/80 bg-white/85 backdrop-blur-md print:hidden">
      <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label={t('home')} className="rounded-pill">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">{links}</ul>
        </nav>
        <LocaleSwitcher />
      </div>
      <nav aria-label="Primary" className="border-t border-hairline/80 md:hidden">
        <ul className="mx-auto scrollbar-none flex max-w-page gap-1 overflow-x-auto px-2 py-1.5">{links}</ul>
      </nav>
    </header>
  );
}
