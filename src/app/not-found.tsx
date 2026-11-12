import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { fontVariables } from './fonts';

// Non-localized 404 (paths outside the next-intl matcher). Localized 404s use app/[locale]/not-found.tsx.
export default function GlobalNotFound() {
  return (
    <html lang="tr" dir="ltr" data-script="latin" className={fontVariables}>
      <body className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="flex flex-col items-center">
          <Logo size={96} wordmark={false} />
          <h1 className="mt-6 font-display text-h1 font-extrabold">404</h1>
          <p className="mt-4 text-ui text-stone">Sayfa bulunamadı · Page not found · الصفحة غير موجودة</p>
          <Link href="/tr" className="mt-8 inline-flex min-h-12 items-center rounded-pill bg-charcoal px-6 text-ui font-semibold text-white hover:bg-terracotta">
            Naif Mutfak
          </Link>
        </div>
      </body>
    </html>
  );
}
