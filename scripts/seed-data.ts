// Local development seed content. Validated with the app's Zod schemas in scripts/seed.ts.
import type { Ingredients, Instructions, Locale } from '../src/validators/content.ts';

export interface SeedPostTranslation {
  locale: Locale;
  slug: string;
  title: string;
  dek: string;
  bodyMd: string;
  heroImageAlt: string;
  seoTitle: string;
  seoDescription: string;
  ingredients: Ingredients;
  instructions: Instructions;
  keywords: string[];
  cuisine: string;
}

export interface SeedPost {
  id: string;
  category: string;
  prepMinutes: number;
  cookMinutes: number;
  restMinutes: number;
  baseServings: number;
  difficulty: 'easy' | 'medium' | 'advanced';
  publishedAt: string;
  translations: SeedPostTranslation[];
}

export const PRODUCT_ID = '3f2a9d64-8c1b-4e7a-b5d2-0c6e1f4a7b10';
export const PRODUCT_SLUG = 'baking-at-home';

export const product = {
  id: PRODUCT_ID,
  slug: PRODUCT_SLUG,
  pageCount: 148,
  translations: [
    {
      locale: 'tr',
      title: 'Evde Fırın: Ekmek ve Hamur İşleri',
      subtitle: 'Ekşi mayadan baklavaya, adım adım 42 tarif',
      descriptionMd:
        'Ev fırınında profesyonel sonuçlar için yazılmış, her tarifi en az üç kez test edilmiş bir kitap.\n\n- Ekşi maya başlatma ve besleme takvimi\n- Gramajlı, ölçeklenebilir tarifler\n- Her bölümde sık yapılan hatalar ve çözümleri',
      coverAlt: 'Keten bez üzerinde unlanmış yuvarlak ekşi mayalı ekmek; kitabın kapağı',
    },
    {
      locale: 'en',
      title: 'Baking at Home: Bread & Pastry',
      subtitle: 'From sourdough to baklava, 42 recipes step by step',
      descriptionMd:
        'A book written for professional results in a home oven, with every recipe tested at least three times.\n\n- A sourdough starter and feeding schedule\n- Gram-weighted, scalable recipes\n- Common mistakes and fixes in every chapter',
      coverAlt: 'A floured round sourdough loaf on linen; the book cover',
    },
    {
      locale: 'ar',
      title: 'الخَبز في البيت: الخبز والمعجنات',
      subtitle: 'من العجين المخمّر إلى البقلاوة، ٤٢ وصفة خطوة بخطوة',
      descriptionMd:
        'كتاب كُتب للحصول على نتائج احترافية في فرن البيت، وقد جُرّبت كل وصفة فيه ثلاث مرات على الأقل.\n\n- جدول لتحضير الخميرة الطبيعية وتغذيتها\n- وصفات بالغرامات قابلة للمضاعفة\n- الأخطاء الشائعة وحلولها في كل فصل',
      coverAlt: 'رغيف عجين مخمّر مستدير ومرشوش بالدقيق على قماش كتان؛ غلاف الكتاب',
    },
  ],
  variants: [
    { id: '3f2a9d64-8c1b-4e7a-b5d2-0c6e1f4a7b11', contentLocale: 'tr', sku: 'EBOOK-BAKING-TR', ls: '100001', paddle: 'pri_seed_baking_tr' },
    { id: '3f2a9d64-8c1b-4e7a-b5d2-0c6e1f4a7b12', contentLocale: 'en', sku: 'EBOOK-BAKING-EN', ls: '100002', paddle: 'pri_seed_baking_en' },
    { id: '3f2a9d64-8c1b-4e7a-b5d2-0c6e1f4a7b13', contentLocale: 'ar', sku: 'EBOOK-BAKING-AR', ls: '100003', paddle: 'pri_seed_baking_ar' },
  ],
  /** Display prices in minor units (kuruş / cents / halalas). */
  prices: { priceTry: 34900, priceUsd: 1200, priceSar: 4500 },
} as const satisfies {
  id: string;
  slug: string;
  pageCount: number;
  translations: readonly { locale: Locale; title: string; subtitle: string; descriptionMd: string; coverAlt: string }[];
  variants: readonly { id: string; contentLocale: Locale; sku: string; ls: string; paddle: string }[];
  prices: { priceTry: number; priceUsd: number; priceSar: number };
};

const callout = `::ebook{product="${PRODUCT_SLUG}"}`;

/* ───────────── Sourdough Country Loaf ───────────── */

const sourdough: SeedPost = {
  id: '7b0c6c1e-0a51-4c39-9a3e-5f1d2c9e1a01',
  category: 'bread',
  prepMinutes: 30,
  cookMinutes: 45,
  restMinutes: 840,
  baseServings: 12,
  difficulty: 'advanced',
  publishedAt: '2026-10-18T08:00:00Z',
  translations: [
    {
      locale: 'tr',
      slug: 'eksi-mayali-koy-ekmegi',
      title: 'Ekşi Mayalı Köy Ekmeği',
      dek: 'Çıtır kabuk, parlak ve açık gözenekli bir iç: iki günlük sabrın en sade ödülü.',
      heroImageAlt: 'Döküm tencereden yeni çıkmış, kabuğu çatlamış ekşi mayalı ekmek',
      seoTitle: 'Ekşi Mayalı Köy Ekmeği Tarifi (Adım Adım)',
      seoDescription: 'Ev fırınında çıtır kabuklu, açık gözenekli ekşi mayalı köy ekmeği: gramajlı tarif, zamanlama ve ipuçları.',
      cuisine: 'Avrupa',
      keywords: ['ekşi maya', 'köy ekmeği', 'ev yapımı ekmek'],
      bodyMd: `Ekşi mayalı ekmek bir tariften çok bir ritimdir. Mayanız aktif, hamurunuz sıcak ve siz sabırlı olduğunuzda, ev fırını bile fırıncı vitrinindeki somunlara yaklaşır.

## Mayayı hazırlamak

Hamuru yoğurmadan dört ila altı saat önce mayanızı besleyin. Hacmi iki katına çıktığında ve üzeri kubbe gibi kabardığında hazırdır.

> Küçük bir test: bir çay kaşığı mayayı suya bırakın. Yüzüyorsa hazır.

## Hamur sıcaklığı her şeydir

Hedef hamur sıcaklığı 24–26 °C. Suyun sıcaklığını mevsime göre ayarlayın; kışın ılık, yazın serin su kullanın.

${callout}

## Katlama ve şekillendirme

İlk iki saat boyunca her 30 dakikada bir germe-katlama yapın. Ardından hamuru dinlendirin, sıkıca şekillendirin ve gece boyu buzdolabında mayalandırın.

- Islak elle çalışın, un eklemeyin.
- Şekillendirirken yüzey gerilimi oluşturun.
- Soğuk hamuru doğrudan fırına alın.`,
      ingredients: [
        {
          title: 'Hamur için',
          items: [
            { id: 'flour-bread', quantity: 450, unit: 'g', name: 'ekmeklik un', scalable: true },
            { id: 'flour-wholewheat', quantity: 50, unit: 'g', name: 'tam buğday unu', scalable: true },
            { id: 'water', quantity: 375, unit: 'g', name: 'su', note: '27 °C', scalable: true },
            { id: 'starter', quantity: 100, unit: 'g', name: 'aktif ekşi maya', scalable: true },
            { id: 'salt', quantity: 10, unit: 'g', name: 'ince deniz tuzu', scalable: true },
          ],
        },
        {
          title: 'Pişirme için',
          items: [{ id: 'rice-flour', quantity: null, name: 'pirinç unu (sepet için)', scalable: false }],
        },
      ],
      instructions: [
        {
          title: 'Hamur',
          steps: [
            { id: 'mix', text: 'Unları ve 350 g suyu karıştırın, üzerini örtüp 45 dakika otolize bırakın.', timerSeconds: 2700 },
            { id: 'add-starter', text: 'Mayayı, tuzu ve kalan suyu ekleyip hamur pürüzsüzleşene kadar sıkıştırarak karıştırın.' },
            { id: 'folds', text: 'İlk iki saat boyunca her 30 dakikada bir germe-katlama yapın; toplam dört set.', timerSeconds: 1800 },
          ],
        },
        {
          title: 'Şekillendirme ve pişirme',
          steps: [
            { id: 'shape', text: 'Hamuru yuvarlayıp 20 dakika dinlendirin, ardından sıkıca şekillendirip unlanmış sepete alın.' },
            { id: 'retard', text: 'Üzerini örtüp buzdolabında 12–14 saat mayalandırın.' },
            { id: 'bake', text: 'Döküm tencereyi 250 °C fırında ısıtın. Hamuru çizip kapaklı 20 dakika, kapaksız 25 dakika pişirin.', timerSeconds: 1200 },
            { id: 'cool', text: 'Kesmeden önce tel ızgarada en az bir saat soğutun.' },
          ],
        },
      ],
    },
    {
      locale: 'en',
      slug: 'sourdough-country-loaf',
      title: 'Sourdough Country Loaf',
      dek: 'A crackling crust and a glossy, open crumb: the plainest reward for two days of patience.',
      heroImageAlt: 'A freshly baked sourdough loaf with a burst crust, just out of a cast-iron pot',
      seoTitle: 'Sourdough Country Loaf Recipe (Step by Step)',
      seoDescription: 'A crisp, open-crumbed sourdough country loaf in a home oven: gram-weighted recipe, timeline and tips.',
      cuisine: 'European',
      keywords: ['sourdough', 'country loaf', 'homemade bread'],
      bodyMd: `Sourdough is less a recipe than a rhythm. When your starter is lively, your dough is warm and you are patient, even a home oven comes close to the loaves in a bakery window.

## Getting the starter ready

Feed your starter four to six hours before mixing. It is ready when it has doubled and its surface is domed.

> A quick test: drop a teaspoon of starter into water. If it floats, it is ready.

## Dough temperature is everything

Aim for a dough temperature of 24–26 °C. Adjust the water to the season: warm in winter, cool in summer.

${callout}

## Folding and shaping

Stretch and fold every 30 minutes for the first two hours. Then let the dough rest, shape it tightly and proof it overnight in the fridge.

- Work with wet hands; do not add flour.
- Build surface tension as you shape.
- Bake the dough straight from the fridge.`,
      ingredients: [
        {
          title: 'For the dough',
          items: [
            { id: 'flour-bread', quantity: 450, unit: 'g', name: 'bread flour', scalable: true },
            { id: 'flour-wholewheat', quantity: 50, unit: 'g', name: 'whole wheat flour', scalable: true },
            { id: 'water', quantity: 375, unit: 'g', name: 'water', note: '27 °C', scalable: true },
            { id: 'starter', quantity: 100, unit: 'g', name: 'active sourdough starter', scalable: true },
            { id: 'salt', quantity: 10, unit: 'g', name: 'fine sea salt', scalable: true },
          ],
        },
        {
          title: 'For baking',
          items: [{ id: 'rice-flour', quantity: null, name: 'rice flour (for the basket)', scalable: false }],
        },
      ],
      instructions: [
        {
          title: 'The dough',
          steps: [
            { id: 'mix', text: 'Mix the flours with 350 g of the water, cover and autolyse for 45 minutes.', timerSeconds: 2700 },
            { id: 'add-starter', text: 'Add the starter, salt and remaining water; squeeze and fold until smooth.' },
            { id: 'folds', text: 'Stretch and fold every 30 minutes for the first two hours, four sets in total.', timerSeconds: 1800 },
          ],
        },
        {
          title: 'Shaping and baking',
          steps: [
            { id: 'shape', text: 'Pre-shape into a round, rest 20 minutes, then shape tightly and place in a floured basket.' },
            { id: 'retard', text: 'Cover and proof in the fridge for 12–14 hours.' },
            { id: 'bake', text: 'Preheat a cast-iron pot at 250 °C. Score the dough, bake 20 minutes covered and 25 minutes uncovered.', timerSeconds: 1200 },
            { id: 'cool', text: 'Cool on a wire rack for at least one hour before slicing.' },
          ],
        },
      ],
    },
    {
      locale: 'ar',
      slug: 'khubz-al-ajeen-al-mukhammar',
      title: 'خبز ريفي بالعجين المخمّر',
      dek: 'قشرة مقرمشة ولبّ لامع واسع المسامّ: أبسط مكافأة ليومين من الصبر.',
      heroImageAlt: 'رغيف عجين مخمّر خرج للتو من قدر الحديد الزهر وقشرته متشققة',
      seoTitle: 'وصفة الخبز الريفي بالعجين المخمّر خطوة بخطوة',
      seoDescription: 'خبز ريفي بالعجين المخمّر بقشرة مقرمشة ولبّ مفتوح في فرن البيت: وصفة بالغرامات وجدول زمني ونصائح.',
      cuisine: 'أوروبي',
      keywords: ['عجين مخمّر', 'خبز ريفي', 'خبز منزلي'],
      bodyMd: `الخبز بالعجين المخمّر إيقاعٌ أكثر منه وصفة. حين تكون الخميرة نشطة والعجين دافئاً وتتحلّى بالصبر، يقترب فرن البيت من أرغفة واجهات المخابز.

## تحضير الخميرة

أطعِم الخميرة قبل العجن بأربع إلى ست ساعات. تكون جاهزة حين يتضاعف حجمها ويصبح سطحها مقبّباً.

> اختبار سريع: ضع ملعقة صغيرة من الخميرة في الماء. إن طفت فهي جاهزة.

## حرارة العجين هي كل شيء

استهدف حرارة عجين بين ٢٤ و٢٦ درجة مئوية. اضبط حرارة الماء حسب الموسم: دافئاً في الشتاء وبارداً في الصيف.

${callout}

## الطيّ والتشكيل

اطوِ العجين بالشدّ كل ٣٠ دقيقة خلال الساعتين الأوليين. ثم اتركه يرتاح، وشكّله بإحكام، واتركه يتخمّر طوال الليل في الثلاجة.

- اعمل بيدين مبلّلتين ولا تُضِف دقيقاً.
- اصنع توتّراً على سطح العجين أثناء التشكيل.
- اخبز العجين مباشرة من الثلاجة.`,
      ingredients: [
        {
          title: 'للعجين',
          items: [
            { id: 'flour-bread', quantity: 450, unit: 'غ', name: 'دقيق الخبز', scalable: true },
            { id: 'flour-wholewheat', quantity: 50, unit: 'غ', name: 'دقيق القمح الكامل', scalable: true },
            { id: 'water', quantity: 375, unit: 'غ', name: 'ماء', note: '٢٧ درجة مئوية', scalable: true },
            { id: 'starter', quantity: 100, unit: 'غ', name: 'خميرة طبيعية نشطة', scalable: true },
            { id: 'salt', quantity: 10, unit: 'غ', name: 'ملح بحري ناعم', scalable: true },
          ],
        },
        {
          title: 'للخَبز',
          items: [{ id: 'rice-flour', quantity: null, name: 'دقيق الأرز (للسلة)', scalable: false }],
        },
      ],
      instructions: [
        {
          title: 'العجين',
          steps: [
            { id: 'mix', text: 'اخلط الدقيقين مع ٣٥٠ غ من الماء، وغطِّ الوعاء واتركه ٤٥ دقيقة.', timerSeconds: 2700 },
            { id: 'add-starter', text: 'أضِف الخميرة والملح وباقي الماء، واعصر العجين واطوِه حتى يصبح ناعماً.' },
            { id: 'folds', text: 'اطوِ العجين بالشدّ كل ٣٠ دقيقة خلال الساعتين الأوليين، أربع مرات في المجموع.', timerSeconds: 1800 },
          ],
        },
        {
          title: 'التشكيل والخَبز',
          steps: [
            { id: 'shape', text: 'كوّر العجين واتركه ٢٠ دقيقة، ثم شكّله بإحكام وضعه في سلة مرشوشة بالدقيق.' },
            { id: 'retard', text: 'غطِّه واتركه يتخمّر في الثلاجة من ١٢ إلى ١٤ ساعة.' },
            { id: 'bake', text: 'سخّن قدر الحديد الزهر في فرن حرارته ٢٥٠ درجة. اشرط العجين واخبزه ٢٠ دقيقة مغطّى و٢٥ دقيقة مكشوفاً.', timerSeconds: 1200 },
            { id: 'cool', text: 'اتركه يبرد على شبكة ساعة على الأقل قبل تقطيعه.' },
          ],
        },
      ],
    },
  ],
};

/* ───────────── Pistachio Baklava ───────────── */

const baklava: SeedPost = {
  id: '7b0c6c1e-0a51-4c39-9a3e-5f1d2c9e1a02',
  category: 'pastry',
  prepMinutes: 60,
  cookMinutes: 50,
  restMinutes: 240,
  baseServings: 24,
  difficulty: 'medium',
  publishedAt: '2026-11-02T08:00:00Z',
  translations: [
    {
      locale: 'tr',
      slug: 'antep-fistikli-baklava',
      title: 'Antep Fıstıklı Baklava',
      dek: 'Hazır yufkayla, ama acele etmeden: kat kat çıtırlık ve tam kıvamında şerbet.',
      heroImageAlt: 'Tepside dilimlenmiş, üzeri toz fıstıkla kaplı baklava',
      seoTitle: 'Antep Fıstıklı Baklava Tarifi (Hazır Yufkayla)',
      seoDescription: 'Hazır yufkayla çıtır, şerbeti tam kıvamında Antep fıstıklı baklava: ölçüler, pişirme süreleri ve ipuçları.',
      cuisine: 'Türk',
      keywords: ['baklava', 'antep fıstığı', 'şerbetli tatlı'],
      bodyMd: `İyi bir baklavanın sırrı iki sıcaklık arasındaki farkta saklı: sıcak baklava, soğuk şerbet. Gerisi sabır ve bol tereyağı.

## Yufkayı tanımak

Hazır baklava yufkasını oda sıcaklığına getirin ve kurumaması için üzerini nemli bir bezle örtün.

## Şerbeti önceden hazırlayın

Şerbet tamamen soğumalı. Bir gün önceden hazırlamak en kolayı.

${callout}

## Kesmek ve pişirmek

Baklavayı pişirmeden önce keskin bir bıçakla dilimleyin. Fırının alt rafında, altı ve üstü altın rengi olana kadar pişirin.`,
      ingredients: [
        {
          title: 'Baklava için',
          items: [
            { id: 'phyllo', quantity: 500, unit: 'g', name: 'baklava yufkası', scalable: true },
            { id: 'butter', quantity: 300, unit: 'g', name: 'sade yağ veya eritilmiş tereyağı', scalable: true },
            { id: 'pistachio', quantity: 250, unit: 'g', name: 'Antep fıstığı, iri çekilmiş', scalable: true },
          ],
        },
        {
          title: 'Şerbet için',
          items: [
            { id: 'sugar', quantity: 600, unit: 'g', name: 'toz şeker', scalable: true },
            { id: 'syrup-water', quantity: 500, unit: 'ml', name: 'su', scalable: true },
            { id: 'lemon', quantity: 1, unit: 'yemek kaşığı', name: 'limon suyu', scalable: true },
          ],
        },
      ],
      instructions: [
        {
          title: 'Şerbet',
          steps: [
            { id: 'syrup', text: 'Şeker ve suyu kaynatın, 10 dakika kaynadıktan sonra limon suyunu ekleyip tamamen soğutun.', timerSeconds: 600 },
          ],
        },
        {
          title: 'Baklava',
          steps: [
            { id: 'layer-bottom', text: 'Tepsiyi yağlayın; yufkanın yarısını her katı yağlayarak serin.' },
            { id: 'nuts', text: 'Fıstığı eşit şekilde yayın.' },
            { id: 'layer-top', text: 'Kalan yufkaları aynı şekilde yağlayarak serin ve dilimleyin.' },
            { id: 'bake', text: '170 °C fırında altın rengi olana kadar 50 dakika pişirin.', timerSeconds: 3000 },
            { id: 'soak', text: 'Soğuk şerbeti sıcak baklavanın üzerine dökün ve en az 4 saat dinlendirin.' },
          ],
        },
      ],
    },
    {
      locale: 'en',
      slug: 'pistachio-baklava',
      title: 'Pistachio Baklava',
      dek: 'Store-bought phyllo, but no shortcuts: layer upon layer of crunch and a perfectly set syrup.',
      heroImageAlt: 'Sliced baklava in a tray, topped with ground pistachios',
      seoTitle: 'Pistachio Baklava Recipe (With Store-Bought Phyllo)',
      seoDescription: 'Crisp pistachio baklava with store-bought phyllo and a perfectly set syrup: measurements, bake times and tips.',
      cuisine: 'Turkish',
      keywords: ['baklava', 'pistachio', 'syrup dessert'],
      bodyMd: `The secret of good baklava lies in a difference of temperature: hot pastry, cold syrup. The rest is patience and plenty of butter.

## Getting to know the phyllo

Bring the phyllo to room temperature and keep it under a damp towel so it does not dry out.

## Make the syrup ahead

The syrup must be completely cold. Making it a day ahead is easiest.

${callout}

## Cutting and baking

Cut the baklava with a sharp knife before baking. Bake on the lowest rack until golden on top and bottom.`,
      ingredients: [
        {
          title: 'For the baklava',
          items: [
            { id: 'phyllo', quantity: 500, unit: 'g', name: 'phyllo dough', scalable: true },
            { id: 'butter', quantity: 300, unit: 'g', name: 'clarified or melted butter', scalable: true },
            { id: 'pistachio', quantity: 250, unit: 'g', name: 'pistachios, coarsely ground', scalable: true },
          ],
        },
        {
          title: 'For the syrup',
          items: [
            { id: 'sugar', quantity: 600, unit: 'g', name: 'granulated sugar', scalable: true },
            { id: 'syrup-water', quantity: 500, unit: 'ml', name: 'water', scalable: true },
            { id: 'lemon', quantity: 1, unit: 'tbsp', name: 'lemon juice', scalable: true },
          ],
        },
      ],
      instructions: [
        {
          title: 'The syrup',
          steps: [
            { id: 'syrup', text: 'Boil the sugar and water for 10 minutes, add the lemon juice and cool completely.', timerSeconds: 600 },
          ],
        },
        {
          title: 'The baklava',
          steps: [
            { id: 'layer-bottom', text: 'Butter the tray; lay half of the phyllo, brushing each sheet with butter.' },
            { id: 'nuts', text: 'Spread the pistachios evenly.' },
            { id: 'layer-top', text: 'Layer the remaining sheets the same way, then cut into pieces.' },
            { id: 'bake', text: 'Bake at 170 °C for 50 minutes, until golden.', timerSeconds: 3000 },
            { id: 'soak', text: 'Pour the cold syrup over the hot baklava and rest for at least 4 hours.' },
          ],
        },
      ],
    },
    {
      locale: 'ar',
      slug: 'baklawa-bil-fustuq',
      title: 'بقلاوة بالفستق الحلبي',
      dek: 'بعجينة جاهزة لكن من دون استعجال: طبقات مقرمشة وقطر بالقوام المثالي.',
      heroImageAlt: 'بقلاوة مقطّعة في صينية ومغطاة بالفستق المطحون',
      seoTitle: 'وصفة بقلاوة بالفستق الحلبي بعجينة جاهزة',
      seoDescription: 'بقلاوة مقرمشة بالفستق الحلبي بعجينة الفيلو الجاهزة وقطر بالقوام المثالي: المقادير وأوقات الخَبز ونصائح.',
      cuisine: 'تركي',
      keywords: ['بقلاوة', 'فستق حلبي', 'حلويات بالقطر'],
      bodyMd: `سرّ البقلاوة الجيدة في فرق الحرارة: بقلاوة ساخنة وقطر بارد. والباقي صبرٌ وكثيرٌ من الزبدة.

## التعرّف على العجينة

اترك عجينة الفيلو حتى تصل إلى حرارة الغرفة، وغطّها بمنشفة رطبة كي لا تجف.

## حضّر القطر مسبقاً

يجب أن يكون القطر بارداً تماماً. الأسهل أن تحضّره قبل يوم.

${callout}

## التقطيع والخَبز

قطّع البقلاوة بسكين حادة قبل الخَبز. اخبزها على الرف السفلي حتى يصبح وجهها وقاعها ذهبيين.`,
      ingredients: [
        {
          title: 'للبقلاوة',
          items: [
            { id: 'phyllo', quantity: 500, unit: 'غ', name: 'عجينة الفيلو', scalable: true },
            { id: 'butter', quantity: 300, unit: 'غ', name: 'سمن أو زبدة مذوّبة', scalable: true },
            { id: 'pistachio', quantity: 250, unit: 'غ', name: 'فستق حلبي مطحون خشناً', scalable: true },
          ],
        },
        {
          title: 'للقطر',
          items: [
            { id: 'sugar', quantity: 600, unit: 'غ', name: 'سكر', scalable: true },
            { id: 'syrup-water', quantity: 500, unit: 'مل', name: 'ماء', scalable: true },
            { id: 'lemon', quantity: 1, unit: 'ملعقة كبيرة', name: 'عصير ليمون', scalable: true },
          ],
        },
      ],
      instructions: [
        {
          title: 'القطر',
          steps: [
            { id: 'syrup', text: 'اغلِ السكر والماء ١٠ دقائق، ثم أضِف عصير الليمون واتركه يبرد تماماً.', timerSeconds: 600 },
          ],
        },
        {
          title: 'البقلاوة',
          steps: [
            { id: 'layer-bottom', text: 'ادهن الصينية بالزبدة، وافرد نصف العجينة مع دهن كل ورقة.' },
            { id: 'nuts', text: 'وزّع الفستق بالتساوي.' },
            { id: 'layer-top', text: 'افرد باقي الأوراق بالطريقة نفسها، ثم قطّعها.' },
            { id: 'bake', text: 'اخبزها في فرن حرارته ١٧٠ درجة مدة ٥٠ دقيقة حتى تصبح ذهبية.', timerSeconds: 3000 },
            { id: 'soak', text: 'اسكب القطر البارد على البقلاوة الساخنة واتركها ٤ ساعات على الأقل.' },
          ],
        },
      ],
    },
  ],
};

export const seedPosts: SeedPost[] = [sourdough, baklava];
