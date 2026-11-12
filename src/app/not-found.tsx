import Link from 'next/link';
import { fontVariables } from './fonts';

// Non-localized 404 (paths outside the next-intl matcher). Localized 404s use app/[locale]/not-found.tsx.
export default function GlobalNotFound() {
  return (
    <html lang="tr" dir="ltr" data-script="latin" className={fontVariables}>
      <body className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-h1">404</h1>
          <p className="mt-4 text-ui text-stone">Sayfa bulunamadı · Page not found · الصفحة غير موجودة</p>
          <Link href="/tr" className="mt-8 inline-block text-ui text-terracotta underline underline-offset-4">
            Naif Mutfak
          </Link>
        </div>
      </body>
    </html>
  );
}
