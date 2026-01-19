import { Check } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type PricingPlan } from "@shared/schema";

interface PricingCardProps {
  plan: PricingPlan;
}

export function PricingCard({ plan }: PricingCardProps) {
  return (
    <Card
      className={`relative overflow-hidden hover-elevate ${
        plan.isRecommended ? "border-primary shadow-lg" : ""
      }`}
      data-testid={`card-pricing-${plan.id}`}
    >
      {plan.isRecommended && (
        <div className="absolute right-0 top-0 rounded-bl-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground" data-testid={`badge-recommended-${plan.id}`}>
          Recommandé
        </div>
      )}
      
      <CardHeader className="pb-4 pt-6 px-6 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-xl font-semibold" data-testid={`text-plan-name-${plan.id}`}>{plan.name}</h3>
          {plan.savings && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400" data-testid={`badge-savings-${plan.id}`}>
              {plan.savings}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{plan.duration}</p>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        <div className="mb-6">
          <span className="text-4xl font-bold" data-testid={`text-plan-price-${plan.id}`}>{plan.price}€</span>
        </div>

        <ul className="mb-6 space-y-3" data-testid={`list-features-${plan.id}`}>
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-sm" data-testid={`text-feature-${plan.id}-${index}`}>
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <Link href="/numbers">
          <Button
            className="w-full"
            variant={plan.isRecommended ? "default" : "outline"}
            data-testid={`button-select-plan-${plan.id}`}
          >
            Choisir ce plan
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
