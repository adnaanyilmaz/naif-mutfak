import { getTranslations } from 'next-intl/server';
import { NewsletterForm } from '@/components/newsletter/NewsletterForm';

export async function SiteFooter() {
  const t = await getTranslations('Footer');
  const n = await getTranslations('Newsletter');
  return (
    <footer className="print:hidden">
      <section aria-labelledby="newsletter-title" className="bg-linen">
        <div className="mx-auto grid max-w-wide gap-8 px-6 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <h2 id="newsletter-title" className="font-display text-h2 font-semibold">
              {n('title')}
            </h2>
            <p className="mt-3 font-serif text-dek text-stone italic arabic:not-italic">{n('dek')}</p>
          </div>
          <NewsletterForm source="footer" />
        </div>
      </section>
      <div className="border-t border-hairline">
        <p className="mx-auto max-w-page px-6 py-8 text-ui text-stone">
          © {new Date().getFullYear()} Naif Mutfak. {t('rights')}
        </p>
      </div>
    </footer>
  );
}
