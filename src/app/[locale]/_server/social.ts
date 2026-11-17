import { cache } from 'react';
import { socialDeps } from '@/services/container';
import { getSocialLinks } from '@/services/settings/social.service';

/** Memoized per request: the footer (layout) and the home page JSON-LD share one D1 read. */
export const loadSocialLinks = cache(() => getSocialLinks(socialDeps()));
