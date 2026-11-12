import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function LocaleNotFound() {
  const t = useTranslations('NotFound');
  return (
    <section className="mx-auto max-w-content px-6 py-24 text-center">
      <p className="font-display text-display font-extrabold text-terracotta">404</p>
      <h1 className="mt-4 font-display text-h2 font-extrabold">{t('title')}</h1>
      <p className="mt-4 text-dek text-stone">{t('body')}</p>
      <Link href="/" className="mt-8 inline-flex min-h-12 items-center rounded-pill bg-charcoal px-6 text-ui font-semibold text-white hover:bg-terracotta">
        {t('back')}
      </Link>
    </section>
  );
}
