import type { CheckoutParams } from '@/services/payments/provider';

interface LemonSqueezyGlobal {
  Url: { Open: (url: string) => void };
}

interface PaddleGlobal {
  Environment: { set: (env: 'sandbox') => void };
  Initialize: (opts: { token: string }) => void;
  Checkout: {
    open: (opts: {
      items: { priceId: string; quantity: number }[];
      customData: Record<string, string>;
      settings: { displayMode: 'overlay'; locale: string };
    }) => void;
  };
}

declare global {
  interface Window {
    createLemonSqueezy?: () => void;
    LemonSqueezy?: LemonSqueezyGlobal;
    Paddle?: PaddleGlobal;
  }
}

const SCRIPTS = {
  lemonsqueezy: 'https://app.lemonsqueezy.com/js/lemon.js',
  paddle: 'https://cdn.paddle.com/paddle/v2/paddle.js',
} as const;

const loaded = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const existing = loaded.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('script_load_failed'));
    document.head.appendChild(el);
  });
  loaded.set(src, promise);
  return promise;
}

let paddleInitialized = false;

/** Opens the MoR overlay. MoR scripts load only after a buy click. */
export async function openCheckoutOverlay(params: CheckoutParams): Promise<void> {
  if (params.provider === 'lemonsqueezy') {
    await loadScript(SCRIPTS.lemonsqueezy);
    window.createLemonSqueezy?.();
    if (!window.LemonSqueezy) throw new Error('overlay_unavailable');
    window.LemonSqueezy.Url.Open(params.url);
    return;
  }
  await loadScript(SCRIPTS.paddle);
  const paddle = window.Paddle;
  if (!paddle) throw new Error('overlay_unavailable');
  if (!paddleInitialized) {
    if (params.environment === 'sandbox') paddle.Environment.set('sandbox');
    paddle.Initialize({ token: params.clientToken });
    paddleInitialized = true;
  }
  paddle.Checkout.open({
    items: [{ priceId: params.priceId, quantity: 1 }],
    customData: params.customData,
    settings: { displayMode: 'overlay', locale: params.locale },
  });
}
