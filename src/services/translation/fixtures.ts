// Shared test fixtures for translation services (imported by *.test.ts only).
import type { AdminTranslation } from '@/repositories/admin-posts';
import type { ModelPayload } from '@/validators/admin/translation';

export const trSource: AdminTranslation = {
  locale: 'tr',
  slug: 'eksi-mayali-ekmek',
  title: 'Ekşi Mayalı Ekmek',
  dek: 'Çıtır kabuklu köy ekmeği.',
  bodyMd: '## Hamur\n\nUnu 500 g suyla karıştırın.\n\n- Un\n- Su',
  heroImageAlt: 'Tahta üstünde ekmek',
  seoTitle: 'Ekşi mayalı ekmek tarifi',
  seoDescription: 'Evde ekşi mayalı ekmek.',
  ingredients: [
    {
      title: 'Hamur',
      items: [
        { id: 'flour', quantity: 500, unit: 'g', name: 'un', scalable: true },
        { id: 'salt', quantity: 10, unit: 'g', name: 'tuz', note: 'ince', scalable: true },
      ],
    },
  ],
  instructions: [
    {
      title: 'Yapılışı',
      steps: [
        { id: 's1', text: '180°C fırında 25 dakika pişirin.', timerSeconds: 600 },
        { id: 's2', text: 'Soğumaya bırakın.' },
      ],
    },
  ],
  keywords: ['ekmek', 'ekşi maya'],
  cuisine: 'Türk',
  isPublished: true,
};

export function enPayload(over: Partial<ModelPayload> = {}): ModelPayload {
  return {
    title: 'Sourdough Bread',
    dek: 'A crusty village loaf.',
    heroImageAlt: 'Bread on a board',
    seoTitle: 'Sourdough bread recipe',
    seoDescription: 'Sourdough bread at home.',
    cuisine: 'Turkish',
    keywords: ['bread', 'sourdough'],
    groupTitles: ['Dough'],
    ingredients: [
      { id: 'flour', name: 'flour', unit: 'g', note: null },
      { id: 'salt', name: 'salt', unit: 'g', note: 'fine' },
    ],
    sectionTitles: ['Method'],
    steps: [
      { id: 's1', text: 'Bake at 180°C for 25 minutes.' },
      { id: 's2', text: 'Leave to cool.' },
    ],
    ...over,
  };
}
