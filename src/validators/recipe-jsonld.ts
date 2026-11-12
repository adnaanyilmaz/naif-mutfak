import { z } from 'zod';

/** Google Recipe rich-result required fields; used as a publish-time dry run (admin.md §2). */
export const recipeJsonLdRequiredSchema = z.object({
  '@type': z.literal('Recipe'),
  name: z.string().min(1),
  image: z.array(z.url()).min(1),
  recipeIngredient: z.array(z.string().min(1)).min(1),
  recipeInstructions: z.array(z.unknown()).min(1),
});
