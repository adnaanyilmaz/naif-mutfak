import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations('Footer');
  return (
    <footer className="border-t border-hairline">
      <p className="mx-auto max-w-page px-6 py-8 text-ui text-stone">
        © {new Date().getFullYear()} Naif Mutfak. {t('rights')}
      </p>
    </footer>
  );
}
