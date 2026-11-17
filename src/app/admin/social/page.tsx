import { getTranslations } from 'next-intl/server';
import { AdminCard, AdminPageHeader } from '@/components/admin/AdminPage';
import { SocialLinksForm } from '@/components/admin/SocialLinksForm';
import { ADMIN_LOCALE } from '@/i18n/config';
import { socialDeps } from '@/services/container';
import { getSocialLinks } from '@/services/settings/social.service';
import { requireAdmin } from '../_server/require-admin';
import { saveSocialLinksAction } from './actions';

export default async function AdminSocialPage() {
  await requireAdmin();
  const [links, t] = await Promise.all([getSocialLinks(socialDeps()), getTranslations({ locale: ADMIN_LOCALE, namespace: 'Admin' })]);

  return (
    <div className="mx-auto max-w-wide space-y-6">
      <AdminPageHeader title={t('social.title')} subtitle={t('social.subtitle')} />
      <AdminCard title={t('social.profiles')} hint={t('social.hint')}>
        <SocialLinksForm initial={links} saveAction={saveSocialLinksAction} />
      </AdminCard>
    </div>
  );
}
