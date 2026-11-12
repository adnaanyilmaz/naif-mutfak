import type { ReactNode } from 'react';
import './globals.css';

// <html>/<body> are rendered by app/[locale]/layout.tsx (needs lang/dir) and app/admin later.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
