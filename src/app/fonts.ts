import { Amiri, Cormorant_Garamond, IBM_Plex_Sans_Arabic, Inter, Playfair_Display } from 'next/font/google';

// Latin families (TR needs latin-ext for ç ğ ı İ ö ş ü).
export const playfair = Playfair_Display({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

export const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

export const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

// Arabic families: not preloaded; the browser fetches them only where [data-script=arabic] applies.
export const amiri = Amiri({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-amiri',
  display: 'swap',
  preload: false,
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-ar',
  display: 'swap',
  preload: false,
});

export const fontVariables = [playfair, cormorant, inter, amiri, plexArabic].map((f) => f.variable).join(' ');
