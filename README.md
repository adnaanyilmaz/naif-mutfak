# Naif Mutfak

Editoryal bir gastronomi blogu ve çok dilli e-kitap mağazası. Türkçe (varsayılan), İngilizce ve Arapça (sağdan sola) yayın yapar; tarif kartları, e-kitap satışı ve tek kişilik bir yönetim paneli içerir.

Next.js App Router, [OpenNext](https://opennext.js.org/cloudflare) aracılığıyla **Cloudflare Workers** üzerinde çalışır. Veri **D1** (Drizzle ORM), dosyalar **R2** üzerindedir.

## Özellikler

**Site**
- `/tr`, `/en`, `/ar` önekli yerelleştirilmiş sayfalar (`next-intl`); Arapçada `dir="rtl"`, Arapça yazı tipleri ve Arap-Hint rakamları.
- Markdown makaleler; eval kullanmayan bir işleyici ve `::ebook{product="…"}` yönergesiyle e-kitap kutuları.
- Tarif kartı: 1×/2×/3× porsiyon çarpanı, işaretlenebilir malzeme ve adımlar, yazdırma görünümü, Google uyumlu Recipe JSON-LD.
- Bülten kaydı (`POST /api/subscribers`).

**E-kitap mağazası**
- Yerel para birimiyle fiyatlar (TRY / USD / SAR), dil baskıları, ödeme katmanı.
- Merchant of Record: Lemon Squeezy veya Paddle (`PAYMENT_PROVIDER`).
- HMAC imzalı ve idempotent webhook'lar; satın alınan PDF kısa ömürlü imzalı bağlantıyla özel R2 kovasından aktarılır.

**Yönetim paneli (`/admin`)**
- Cloudflare Access ile korunur; Access JWT'si Worker içinde de doğrulanır, e-posta izin listesi uygulanır.
- Çok dilli yazı düzenleyici:
  - Sekmeli veya yan yana dil görünümü.
  - Yapılandırılmış malzeme ve adımlar, "yapıyı TR'den kopyala".
  - Markdown önizleme ve otomatik taslak kaydı.
  - Eşzamanlı düzenleme çakışması koruması.
- E-kitap ve baskı yönetimi; etkinleştirme için PDF ve ödeme sağlayıcı kimliği zorunludur.
- R2'ye doğrudan, ön imzalı yüklemeler; dosya türü sihirli baytlarla doğrulanır, PDF'ler SHA-256 ile kaydedilir.
- Satış ve abone analitiği:
  - Para birimleri ayrı tutulur ve birbirine eklenmez.
  - E-postalar maskelidir; açık gösterim kayda geçer.
  - CSV dışa aktarma.
- Her değişiklik `admin_audit_log` tablosuna yazılır.

## Gereksinimler

- Node.js **≥ 22.12**
- npm (projede `.npmrc` → `legacy-peer-deps=true`)
- Uzak ortam için Cloudflare hesabı (yerel geliştirme için gerekmez; Wrangler D1/R2'yi yerelde taklit eder)

## Kurulum

```bash
npm install
```

Yerel gizli değişkenler için örnek dosyayı kopyalayın ve doldurun:

```bash
cp .dev.vars.example .dev.vars
```

Yerelde en az şunlar gerekir:

| Değişken | Açıklama |
|---|---|
| `DOWNLOAD_SIGNING_SECRET` | İndirme bağlantıları için en az 32 karakter (`openssl rand -hex 32`) |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Aktif sağlayıcının webhook gizli anahtarı |
| `ADMIN_EMAILS` | Virgülle ayrılmış yönetici e-postaları |
| `ADMIN_DEV_EMAIL` | **Yalnızca yerel:** `localhost` üzerinde Access olmadan yönetim paneline giriş |

Veritabanını oluşturup örnek içerik yükleyin (2 tarif × 3 dil, 1 e-kitap × 3 baskı):

```bash
npm run db:seed
```

Geliştirme sunucusu:

```bash
npm run dev
```

- Site: http://localhost:3000/tr
- Yönetim paneli: http://localhost:3000/admin

Yerelde R2 S3 kimlik bilgileri tanımlı değilse yüklemeler geliştirmeye özel `/api/admin/uploads/dev` rotasına, görseller `/media/*` rotasına düşer.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Next.js geliştirme sunucusu |
| `npm run preview` | OpenNext derlemesi + Workers çalışma zamanında yerel önizleme |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`any` yasak, fiziksel yön sınıfları yasak, `src/` içinde `node:` içe aktarımı yasak) |
| `npm run test` | Vitest (servisler, doğrulayıcılar ve gerçek D1 üzerinde entegrasyon testleri) |
| `npm run db:generate` | Şema değişikliğinden migration üretir |
| `npm run db:migrate:local` | Migration'ları yerel D1'e uygular |
| `npm run db:seed` | Yerel D1/R2'ye örnek veri yükler (tekrar çalıştırılabilir) |
| `npm run cf-typegen` | `wrangler.jsonc` değişince `CloudflareEnv` tiplerini yeniden üretir |
| `npm run deploy` | Derleyip Cloudflare'e yayınlar |

## Proje yapısı

```
src/
  app/[locale]/        Herkese açık sayfalar (yalnızca görüntüleme)
  app/admin/           Yönetim paneli sayfaları ve Server Action'lar
  app/api/**/route.ts  Rota işleyicileri: ayrıştır → doğrula → servisi çağır → yanıtla
  services/            İş mantığı (çerçeveden bağımsız, bağımlılıklar parametreyle gelir)
  repositories/        D1/Drizzle'a dokunan tek katman
  validators/          Zod şemaları (env, API girdileri, webhook'lar, JSON kolonları)
  lib/cloudflare/      Binding erişimi, R2, Web Crypto yardımcıları
  components/          Sunum bileşenleri ve istemci adacıkları
  db/schema.ts         Drizzle şeması (tek doğruluk kaynağı)
  i18n/                Yerel ayar, yön ve para birimi eşlemeleri
messages/{tr,en,ar}.json  Tüm arayüz metinleri
migrations/            D1 SQL migration'ları
scripts/               Seed betiği
docs/                  Mimari ve tasarım belgeleri
```

Bağımlılık yönü tek yönlüdür: `app` → `services` → `repositories` → `lib/cloudflare`. Kurallar için [CLAUDE.md](CLAUDE.md) dosyasına bakın.

## Belgeler

- [Veritabanı şeması ve Drizzle kuralları](docs/architecture/database.md)
- [Ödeme, webhook ve PDF teslimi](docs/architecture/payments.md)
- [Yönetim paneli: kimlik doğrulama, editör, yüklemeler, analitik](docs/architecture/admin.md)
- [Editoryal tasarım sistemi](docs/design/editorial-system.md)

## Yayına alma

1. D1 veritabanını oluşturun ve `wrangler.jsonc` içindeki `database_id` değerini güncelleyin:
   ```bash
   npx wrangler d1 create naif-mutfak-db
   ```
2. Migration'ları uzak veritabanına uygulayın (önce yerelde doğrulayın):
   ```bash
   npx wrangler d1 migrations apply naif-mutfak-db --remote
   ```
3. Gizli değişkenleri tanımlayın (`npx wrangler secret put <AD>`):
   - Ödeme: `DOWNLOAD_SIGNING_SECRET`, aktif sağlayıcının webhook/API anahtarları
   - Yönetim: `ADMIN_EMAILS`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`
   - Yüklemeler: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (yalnızca iki kovaya yetkili token)
4. Cloudflare Access'te `/admin*` ve `/api/admin*` için bir uygulama ve e-posta politikası oluşturun.
5. R2 kovalarına CORS kuralını ekleyin (`PUT`, site kaynağı; ayrıntılar `docs/architecture/admin.md` §3).
6. Yayınlayın:
   ```bash
   npm run deploy
   ```

`ADMIN_DEV_EMAIL` üretimde **tanımlanmamalıdır**; tanımlıysa yapılandırma doğrulaması başarısız olur.

## Bilinen eksikler

- Bülten onay e-postası ve satın alma makbuzu e-postası gönderilmiyor.
- Ödeme ve indirme uç noktalarında hız sınırlama yok.
- `/checkout/success` sayfası yok.
- Tamamlanmamış yüklemeleri temizleyen günlük Cron görevi yok.
