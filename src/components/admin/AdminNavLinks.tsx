'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { BookIcon, CardIcon, ChartIcon, HomeIcon, PostsIcon, ShareIcon, UsersIcon } from './icons';

const GROUPS = [
  { key: null, items: [{ href: '/admin', key: 'overview', Icon: HomeIcon, exact: true }] },
  {
    key: 'content',
    items: [
      { href: '/admin/posts', key: 'posts', Icon: PostsIcon, exact: false },
      { href: '/admin/products', key: 'products', Icon: BookIcon, exact: false },
    ],
  },
  {
    key: 'insights',
    items: [
      { href: '/admin/analytics/sales', key: 'sales', Icon: ChartIcon, exact: false },
      { href: '/admin/analytics/subscribers', key: 'subscribers', Icon: UsersIcon, exact: false },
    ],
  },
  {
    key: 'settings',
    items: [
      { href: '/admin/payments', key: 'payments', Icon: CardIcon, exact: false },
      { href: '/admin/social', key: 'social', Icon: ShareIcon, exact: false },
    ],
  },
] as const;

export function AdminNavLinks() {
  const t = useTranslations('Admin.nav');
  const pathname = usePathname();
  const isActive = (href: string, exact: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const navRef = useRef<HTMLElement>(null);

  // Phones show the links as one scrolling strip: keep the current section in view after navigating.
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth) return;
    const delta = current.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - current.offsetWidth) / 2;
    nav.scrollBy({ left: delta });
  }, [pathname]);

  return (
    <nav ref={navRef} aria-label={t('label')} className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:gap-0 md:overflow-visible md:pb-0">
      {GROUPS.map((group) => (
        <div key={group.key ?? 'root'} className="flex gap-1 md:mt-4 md:flex-col md:first:mt-0">
          {group.key ? (
            <p className="hidden px-3 pb-1 text-[0.6875rem] font-semibold tracking-wide text-muted uppercase md:block">{t(group.key)}</p>
          ) : null}
          {group.items.map(({ href, key, Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-[0.9375rem] md:gap-3 font-medium whitespace-nowrap transition-colors ${
                  active ? 'bg-terracotta-tint text-terracotta-deep' : 'text-stone hover:bg-linen hover:text-charcoal'
                }`}
              >
                <Icon className={`size-5 ${active ? 'text-terracotta' : 'text-muted'}`} />
                {t(key)}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
