// Small stroke icons for the admin UI (24px grid, currentColor).
import type { ReactNode } from 'react';

function Icon({ children, className = 'size-5' }: { children: ReactNode; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

export const HomeIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Icon>
);
export const PostsIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M14 3v5h5M9 13h7M9 17h5" />
  </Icon>
);
export const BookIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
    <path d="M4 19V5M19 19v2H6" />
  </Icon>
);
export const ChartIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <path d="M4 20V4M4 20h16" />
    <path d="m8 15 3-4 3 2 5-6" />
  </Icon>
);
export const UsersIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 20a6 6 0 0 0-2.5-4.9" />
  </Icon>
);
export const ExternalIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Icon>
);
export const PlusIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const SearchIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);
export const BackIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);
export const ImageIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="m21 16-5-5-9 9" />
  </Icon>
);
export const AlertIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <path d="M12 3 2 20h20z" />
    <path d="M12 10v4M12 17h.01" />
  </Icon>
);
export const CheckIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <path d="m5 12 4.5 4.5L19 7" />
  </Icon>
);
export const CardIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M2.5 10h19M6.5 15h4" />
  </Icon>
);
