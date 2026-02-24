import Stripe from 'stripe';

let connectionSettings: any;

async function getCredentials() {
  const testSecretKey = process.env.SLACK_TEST_API_KEY_GWADA_SMS;
  const liveSecretKey = process.env.SLACK_LIVE_API_KEY_GWADASMS;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';

  const secretKey = isProduction ? (liveSecretKey || testSecretKey) : testSecretKey;

  if (secretKey && publishableKey) {
    return { publishableKey, secretKey };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (xReplitToken && hostname) {
    const connectorName = 'stripe';
    const targetEnvironment = isProduction ? 'production' : 'development';

    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set('include_secrets', 'true');
    url.searchParams.set('connector_names', connectorName);
    url.searchParams.set('environment', targetEnvironment);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      });

      const data = await response.json();
      connectionSettings = data.items?.[0];

      if (connectionSettings?.settings?.publishable && connectionSettings?.settings?.secret) {
        return {
          publishableKey: connectionSettings.settings.publishable,
          secretKey: connectionSettings.settings.secret,
        };
      }
    } catch (err) {
      console.warn('Stripe connector fetch failed');
    }
  }

  throw new Error('Stripe credentials not found. Configure SLACK_TEST_API_KEY_GWADA_SMS and STRIPE_PUBLISHABLE_KEY.');
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey);
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync: any = null;
let lastSecretKey: string | null = null;

export async function getStripeSync() {
  const { secretKey } = await getCredentials();
  if (!stripeSync || lastSecretKey !== secretKey) {
    lastSecretKey = secretKey;
    stripeSync = null;
  }
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
