import { IBM_Plex_Sans_Arabic, Inter, Plus_Jakarta_Sans } from 'next/font/google';

// Latin families (TR needs latin-ext for ç ğ ı İ ö ş ü).
export const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

// Arabic: one modern sans for headings and text; fetched only where [data-script=arabic] applies.
export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-ar',
  display: 'swap',
  preload: false,
});

export const fontVariables = [jakarta, inter, plexArabic].map((f) => f.variable).join(' ');
