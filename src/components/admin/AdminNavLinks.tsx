'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BookIcon, ChartIcon, HomeIcon, PostsIcon, UsersIcon } from './icons';

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
] as const;

export function AdminNavLinks() {
  const t = useTranslations('Admin.nav');
  const pathname = usePathname();
  const isActive = (href: string, exact: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav aria-label={t('label')} className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:gap-0 md:overflow-visible md:pb-0">
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
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[0.9375rem] font-medium whitespace-nowrap transition-colors ${
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
