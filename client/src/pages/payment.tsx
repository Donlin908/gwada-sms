import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, Clock, Loader2, CreditCard, Shield, ArrowLeft } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { pricingPlans, type PhoneNumberResponse, type PricingPlan } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function getSessionId(): string {
  let sessionId = localStorage.getItem("gwada_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("gwada_session_id", sessionId);
  }
  return sessionId;
}

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: Array<{
    id: string;
    unit_amount: number;
    currency: string;
  }>;
}

export default function Payment() {
  const [, params] = useRoute("/payment/:numberId");
  const { toast } = useToast();
  const phoneId = params?.numberId || null;

  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);

  const { data: phoneNumber, isLoading: loadingPhone } = useQuery<PhoneNumberResponse>({
    queryKey: ['/api/numbers', phoneId],
    queryFn: async () => {
      const res = await fetch(`/api/numbers/${phoneId}`);
      if (!res.ok) throw new Error("Phone number not found");
      return res.json();
    },
    enabled: !!phoneId,
  });

  const { data: stripeProducts, isLoading: loadingProducts } = useQuery<{ products: StripeProduct[] }>({
    queryKey: ['/api/stripe/products'],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (data: { priceId: string; phoneNumberId: string; planId: string; sessionId: string }) => {
      const res = await apiRequest("POST", "/api/stripe/create-checkout-session", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la session de paiement",
        variant: "destructive",
      });
    },
  });

  const handleSelectPlan = (plan: PricingPlan) => {
    setSelectedPlan(plan);
  };

  const handleCheckout = () => {
    if (!selectedPlan || !phoneId || !stripeProducts) return;

    const matchingProduct = stripeProducts.products.find(
      (p) => p.metadata?.planId === selectedPlan.id
    );

    if (!matchingProduct || matchingProduct.prices.length === 0) {
      toast({
        title: "Erreur",
        description: "Ce plan n'est pas encore disponible. Veuillez réessayer plus tard.",
        variant: "destructive",
      });
      return;
    }

    checkoutMutation.mutate({
      priceId: matchingProduct.prices[0].id,
      phoneNumberId: phoneId,
      planId: selectedPlan.id,
      sessionId: getSessionId(),
    });
  };

  if (!phoneId) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center py-8">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">Aucun numéro sélectionné</p>
              <Link href="/numbers">
                <Button className="mt-4">Voir les numéros disponibles</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (loadingPhone || loadingProducts) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center py-8">
          <LoadingSpinner size="lg" text="Chargement..." />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8 md:py-12">
        <div className="container px-4 md:px-6">
          <Link href="/numbers">
            <Button variant="ghost" size="sm" className="mb-6 gap-2" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
              Retour aux numéros
            </Button>
          </Link>

          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold" data-testid="text-payment-title">
              Choisissez votre formule
            </h1>
            <p className="text-muted-foreground">
              Sélectionnez la durée de réservation pour le numéro {phoneNumber?.number}
            </p>
          </div>

          {phoneNumber && (
            <Card className="mb-8 bg-primary/5 border-primary/20">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold" data-testid="text-selected-number">{phoneNumber.number}</p>
                  <p className="text-sm text-muted-foreground">
                    {phoneNumber.country === "france" ? "France" : "États-Unis"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            {pricingPlans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative cursor-pointer transition-all hover-elevate ${
                  selectedPlan?.id === plan.id
                    ? "ring-2 ring-primary border-primary"
                    : ""
                } ${plan.isRecommended ? "border-primary/50" : ""}`}
                onClick={() => handleSelectPlan(plan)}
                data-testid={`card-plan-${plan.id}`}
              >
                {plan.isRecommended && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" data-testid="badge-recommended">
                    Recommandé
                  </Badge>
                )}
                {plan.savings && (
                  <Badge variant="secondary" className="absolute -top-3 right-4" data-testid={`badge-savings-${plan.id}`}>
                    {plan.savings}
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl" data-testid={`text-plan-name-${plan.id}`}>{plan.name}</CardTitle>
                  <CardDescription>{plan.duration}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-6">
                    <span className="text-4xl font-bold" data-testid={`text-plan-price-${plan.id}`}>{plan.price}€</span>
                  </div>
                  <ul className="space-y-2 text-left text-sm">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {selectedPlan?.id === plan.id && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-primary">
                      <Check className="h-5 w-5" />
                      <span className="font-medium">Sélectionné</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedPlan && (
            <div className="mt-8 text-center">
              <Button
                size="lg"
                onClick={handleCheckout}
                disabled={checkoutMutation.isPending}
                className="gap-2"
                data-testid="button-checkout"
              >
                {checkoutMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirection...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Payer {selectedPlan.price}€
                  </>
                )}
              </Button>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Paiement sécurisé par Stripe</span>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
