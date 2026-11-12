import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import type trMessages from '../../messages/tr.json';
import { routing } from './routing';

type Messages = typeof trMessages;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = (await import(`../../messages/${locale}.json`)) as { default: Messages };
  return { locale, messages: messages.default };
});
