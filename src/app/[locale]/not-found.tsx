import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function LocaleNotFound() {
  const t = useTranslations('NotFound');
  return (
    <section className="mx-auto max-w-content px-6 py-24 text-center">
      <p className="font-display text-display text-terracotta">404</p>
      <h1 className="mt-4 font-display text-h2">{t('title')}</h1>
      <p className="mt-4 font-serif text-body text-stone">{t('body')}</p>
      <Link href="/" className="mt-8 inline-block text-ui text-terracotta underline underline-offset-4">
        {t('back')}
      </Link>
    </section>
  );
}
