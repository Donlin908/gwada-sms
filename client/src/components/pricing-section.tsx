import { pricingPlans } from "@shared/schema";
import { PricingCard } from "./pricing-card";

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 md:py-28" data-testid="section-pricing">
      <div className="container px-4 md:px-6">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl" data-testid="text-pricing-title">
            Tarifs simples et transparents
          </h2>
          <p className="text-lg text-muted-foreground" data-testid="text-pricing-description">
            Pas d'engagement, pas de frais cachés. Annulation automatique à l'expiration.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3" data-testid="grid-pricing-cards">
          {pricingPlans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}
