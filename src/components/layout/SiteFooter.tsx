import { getTranslations } from 'next-intl/server';
import { NewsletterForm } from '@/components/newsletter/NewsletterForm';
import { Link } from '@/i18n/navigation';
import type { SocialPlatform } from '@/services/settings/social-links';
import { Logo } from './Logo';
import { SocialIcon } from './SocialIcons';

export async function SiteFooter({ profiles }: { profiles: { platform: SocialPlatform; url: string }[] }) {
  const [t, n, h] = await Promise.all([getTranslations('Footer'), getTranslations('Newsletter'), getTranslations('Header')]);
  return (
    <footer className="mt-8 print:hidden">
      <section aria-labelledby="newsletter-title" className="mx-auto max-w-page px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-terracotta-tint px-6 py-12 md:px-14 md:py-16">
          <div aria-hidden className="pointer-events-none absolute -end-16 -top-16 size-64 rounded-full bg-[#ffd59a] opacity-60 blur-2xl" />
          <div className="relative grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 id="newsletter-title" className="font-display text-h2 font-extrabold">
                {n('title')}
              </h2>
              <p className="mt-3 max-w-md text-dek text-stone">{n('dek')}</p>
            </div>
            <NewsletterForm source="footer" />
          </div>
        </div>
      </section>

      <div className="mx-auto mt-12 max-w-page border-t border-hairline px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-ui text-stone">{t('tagline')}</p>
            {profiles.length > 0 && (
              <ul aria-label={t('follow')} className="mt-5 flex gap-2">
                {profiles.map(({ platform, url }) => (
                  <li key={platform}>
                    <a
                      href={url}
                      target="_blank"
                      rel="me noopener noreferrer"
                      aria-label={t('followOn', { platform: t(`platforms.${platform}`) })}
                      className="flex size-11 items-center justify-center rounded-pill border border-hairline text-charcoal transition-colors duration-200 ease-editorial hover:border-terracotta hover:bg-terracotta hover:text-white"
                    >
                      <SocialIcon platform={platform} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <nav aria-label={t('explore')}>
            <p className="text-eyebrow font-semibold text-muted uppercase arabic:normal-case">{t('explore')}</p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-ui font-medium">
              <li>
                <Link href="/blog" className="hover:text-terracotta">
                  {h('recipes')}
                </Link>
              </li>
              <li>
                <Link href="/ebooks" className="hover:text-terracotta">
                  {h('ebooks')}
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-terracotta">
                  {h('about')}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <p className="mt-10 text-[0.8125rem] text-muted">
          © {new Date().getFullYear()} Naif Mutfak. {t('rights')}
        </p>
      </div>
    </footer>
  );
}
