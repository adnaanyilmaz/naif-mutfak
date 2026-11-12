// Admin home: counts and the last 30 days of sales, composed from existing admin services (read-only).
import type { Currency } from '@/validators/content';
import { getSalesDashboard, resolveRange, type AnalyticsDeps } from './analytics.service';
import { listAdminPosts, type AdminPostListView, type AdminPostsDeps } from './posts-admin.service';
import { listAdminProducts, type AdminProductsDeps } from './products-admin.service';

export interface AdminOverview {
  posts: { total: number; published: number; drafts: number; recent: AdminPostListView[] };
  ebooks: { total: number; activeEditions: number; missingPdfs: number };
  sales: { currency: Currency; orders: number; gross: number }[];
  subscribers: { active: number; pending: number };
  failedWebhooks: number;
}

export interface OverviewDeps {
  posts: AdminPostsDeps;
  products: AdminProductsDeps;
  analytics: AnalyticsDeps;
}

export async function getAdminOverview(deps: OverviewDeps): Promise<AdminOverview> {
  const now = deps.analytics.now();
  const range = resolveRange({}, now);
  if (typeof range === 'string') throw new Error(range);

  const [posts, products, sales, statusCounts] = await Promise.all([
    listAdminPosts(deps.posts),
    listAdminProducts(deps.products),
    getSalesDashboard(deps.analytics, range),
    deps.analytics.analytics.subscriberStatusCounts(),
  ]);
  const editions = products.flatMap((p) => p.variants);
  const count = (s: string) => statusCounts.find((r) => r.status === s)?.count ?? 0;

  return {
    posts: {
      total: posts.length,
      published: posts.filter((p) => p.status === 'published').length,
      drafts: posts.filter((p) => p.status === 'draft').length,
      recent: posts.slice(0, 5),
    },
    ebooks: {
      total: products.length,
      activeEditions: editions.filter((v) => v.isActive).length,
      missingPdfs: editions.filter((v) => !v.hasPdf).length,
    },
    sales: sales.kpis.filter((k) => k.orders > 0).map(({ currency, orders, gross }) => ({ currency, orders, gross })),
    subscribers: { active: count('active'), pending: count('pending') },
    failedWebhooks: sales.webhooks.outcomes.find((o) => o.outcome === 'failed')?.count ?? 0,
  };
}
