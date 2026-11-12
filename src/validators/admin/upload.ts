import { z } from 'zod';

export const UPLOAD_KINDS = ['post_hero', 'step_image', 'product_cover', 'ebook_pdf'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export const uploadIntentSchema = z.object({
  kind: z.enum(UPLOAD_KINDS),
  /** postId (post_hero, step_image), productId (product_cover), variantId (ebook_pdf). */
  entityId: z.guid(),
  contentType: z.string().min(3).max(100),
  size: z.number().int().positive(),
  filename: z.string().trim().min(1).max(200),
});

export const uploadFinalizeSchema = z.object({
  kind: z.enum(UPLOAD_KINDS),
  entityId: z.guid(),
  key: z.string().min(1).max(300),
});

export const devUploadQuerySchema = z.object({
  bucket: z.enum(['media', 'ebooks']),
  key: z.string().min(1).max(300),
});

export type UploadIntentInput = z.infer<typeof uploadIntentSchema>;
export type UploadFinalizeInput = z.infer<typeof uploadFinalizeSchema>;
