import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Incremental cache (R2/KV) is added when ISR is introduced; static assets are served from Workers Assets.
export default defineCloudflareConfig({});
