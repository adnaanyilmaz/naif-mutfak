import { Link } from '@/i18n/navigation';

interface CategoryChipsProps {
  categories: ReadonlyArray<{ slug: string; label: string }>;
  /** Slug of the selected category; null selects "all". */
  active: string | null;
  allLabel: string;
  navLabel: string;
}

const base = 'inline-flex min-h-10 items-center rounded-pill px-4 py-2 text-[0.875rem] font-semibold whitespace-nowrap transition-colors duration-200';
const idle = 'bg-linen text-charcoal hover:bg-terracotta-tint hover:text-terracotta-deep';
const selected = 'bg-terracotta text-white';

/** Category filter for the recipe archive: each chip links to that category's page. */
export function CategoryChips({ categories, active, allLabel, navLabel }: CategoryChipsProps) {
  if (categories.length === 0) return null;
  return (
    <nav aria-label={navLabel} className="mt-8">
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link href="/blog" aria-current={active === null ? 'page' : undefined} className={`${base} ${active === null ? selected : idle}`}>
            {allLabel}
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/blog/kategori/${c.slug}`}
              aria-current={active === c.slug ? 'page' : undefined}
              className={`${base} ${active === c.slug ? selected : idle}`}
            >
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
