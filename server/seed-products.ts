import { getUncachableStripeClient } from './stripeClient';

async function seedProducts() {
  console.log('Creating GWADA SMS products in Stripe...');
  
  const stripe = await getUncachableStripeClient();

  const existingProducts = await stripe.products.list({ limit: 100 });
  const existingNames = existingProducts.data.map(p => p.name);

  const plans = [
    {
      name: '24 Heures',
      description: 'Accès à un numéro virtuel pendant 24 heures',
      price: 200,
      metadata: {
        planId: 'daily',
        duration: '24h',
        durationHours: '24',
      }
    },
    {
      name: '7 Jours',
      description: 'Accès à un numéro virtuel pendant 7 jours',
      price: 500,
      metadata: {
        planId: 'weekly',
        duration: '7 jours',
        durationHours: '168',
      }
    },
    {
      name: '30 Jours',
      description: 'Accès à un numéro virtuel pendant 30 jours',
      price: 900,
      metadata: {
        planId: 'monthly',
        duration: '30 jours',
        durationHours: '720',
      }
    }
  ];

  for (const plan of plans) {
    if (existingNames.includes(plan.name)) {
      console.log(`Product "${plan.name}" already exists, skipping...`);
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: plan.metadata,
    });

    await stripe.prices.create({
      product: product.id,
      unit_amount: plan.price,
      currency: 'eur',
    });

    console.log(`Created product: ${plan.name} (${plan.price / 100}€)`);
  }

  console.log('Product seeding completed!');
}

seedProducts().catch(console.error);
