import type { CheckoutParams } from '@/services/payments/provider';

interface LemonSqueezyEvent {
  event: string;
}

interface LemonSqueezyGlobal {
  Url: { Open: (url: string) => void };
  Setup: (opts: { eventHandler: (e: LemonSqueezyEvent) => void }) => void;
}

interface PaddleEvent {
  name?: string;
}

interface PaddleGlobal {
  Environment: { set: (env: 'sandbox') => void };
  Initialize: (opts: { token: string; eventCallback?: (e: PaddleEvent) => void }) => void;
  Checkout: {
    open: (opts: {
      items: { priceId: string; quantity: number }[];
      customData: Record<string, string>;
      settings: { displayMode: 'overlay'; locale: string; successUrl?: string };
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
/** Updated on every open so the (one-time) Paddle callback always routes to the latest locale. */
let successPathRef = '/';

/**
 * Opens the payment screen. MoR scripts load only after a buy click. On a successful payment the
 * buyer is routed to `successPath` (`/{locale}/checkout/success`), which polls the order status.
 */
export async function openCheckoutOverlay(params: CheckoutParams, successPath: string): Promise<void> {
  successPathRef = successPath;
  if (params.provider === 'test') {
    window.location.assign(params.url);
    return;
  }
  if (params.provider === 'lemonsqueezy') {
    await loadScript(SCRIPTS.lemonsqueezy);
    window.createLemonSqueezy?.();
    const ls = window.LemonSqueezy;
    if (!ls) throw new Error('overlay_unavailable');
    ls.Setup({
      eventHandler: (e) => {
        if (e.event === 'Checkout.Success') window.location.assign(successPathRef);
      },
    });
    ls.Url.Open(params.url);
    return;
  }
  await loadScript(SCRIPTS.paddle);
  const paddle = window.Paddle;
  if (!paddle) throw new Error('overlay_unavailable');
  if (!paddleInitialized) {
    if (params.environment === 'sandbox') paddle.Environment.set('sandbox');
    paddle.Initialize({
      token: params.clientToken,
      eventCallback: (e) => {
        if (e.name === 'checkout.completed') window.location.assign(successPathRef);
      },
    });
    paddleInitialized = true;
  }
  paddle.Checkout.open({
    items: [{ priceId: params.priceId, quantity: 1 }],
    customData: params.customData,
    settings: { displayMode: 'overlay', locale: params.locale, successUrl: `${window.location.origin}${successPath}` },
  });
}
