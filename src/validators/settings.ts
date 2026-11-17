import { z } from 'zod';
import type { SocialLinks } from '@/services/settings/social-links';

const httpsUrl = z.url({ protocol: /^https$/ }).max(300);

/** Stored shape of `site_settings` key `social` (already normalised). */
export const socialLinksSchema = z.object({
  instagram: httpsUrl.nullable(),
  youtube: httpsUrl.nullable(),
  tiktok: httpsUrl.nullable(),
}) satisfies z.ZodType<SocialLinks>;

/** Raw admin form input: URLs or handles, normalised by the service. */
export const socialLinksInputSchema = z.object({
  instagram: z.string().max(300),
  youtube: z.string().max(300),
  tiktok: z.string().max(300),
});

export type SocialLinksInput = z.infer<typeof socialLinksInputSchema>;
