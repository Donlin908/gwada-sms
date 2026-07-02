import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Clock } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CountrySelector } from "@/components/country-selector";
import { NumberCard } from "@/components/number-card";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { type Country, type PhoneNumberResponse } from "@shared/schema";

export default function Numbers() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const initialCountry = (searchParams.get("country") as Country) || "france";
  const planId = searchParams.get("plan") || "";
  
  const [selectedCountry, setSelectedCountry] = useState<Country>(initialCountry);

  const { data: numbers, isLoading, refetch, isRefetching } = useQuery<PhoneNumberResponse[]>({
    queryKey: [`/api/numbers?country=${selectedCountry}`],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const country = params.get("country") as Country;
    if (country && (country === "france" || country === "usa" || country === "canada")) {
      setSelectedCountry(country);
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8 md:py-12">
        <div className="container px-4 md:px-6">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold" data-testid="text-numbers-title">
              Numéros disponibles
            </h1>
            <p className="text-muted-foreground">
              Choisissez un numéro et commencez à recevoir vos SMS instantanément
            </p>
          </div>

          <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
            <CountrySelector
              selected={selectedCountry}
              onChange={setSelectedCountry}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="gap-2"
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>

          {selectedCountry === "france" && (
            <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" data-testid="alert-france-unavailable">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Numéros français temporairement indisponibles.</strong> Veuillez utiliser nos numéros 🇺🇸 États-Unis ou 🇨🇦 Canada en attendant.
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="py-16">
              <LoadingSpinner size="lg" text="Chargement des numéros..." />
            </div>
          ) : numbers && numbers.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {numbers.map((phoneNumber) => (
                <NumberCard key={phoneNumber.id} phoneNumber={phoneNumber} planId={planId} />
              ))}
            </div>
          ) : (
            <EmptyState type="numbers" />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
