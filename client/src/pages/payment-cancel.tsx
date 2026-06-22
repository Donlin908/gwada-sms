import { Link, useSearch } from "wouter";
import { XCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentCancel() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const phoneId = params.get("phone_id");
  const reason = params.get("reason");
  const isDeclined = reason === "declined";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center py-8 md:py-12">
        <div className="container px-4 md:px-6">
          <Card className="mx-auto max-w-lg">
            <CardHeader className="text-center">
              {isDeclined ? (
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                </div>
              ) : (
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <XCircle className="h-10 w-10 text-orange-600 dark:text-orange-400" />
                </div>
              )}
              <CardTitle className="text-2xl" data-testid="text-cancel-title">
                {isDeclined ? "Carte refusée" : "Paiement non finalisé"}
              </CardTitle>
              <CardDescription>
                {isDeclined
                  ? "Votre carte bancaire a été refusée"
                  : "Votre paiement n'a pas été effectué"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isDeclined ? (
                <div className="space-y-3">
                  <p className="text-center text-muted-foreground">
                    Aucun montant n'a été débité. Voici les raisons les plus fréquentes :
                  </p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-red-500">•</span>
                      Fonds insuffisants sur le compte
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-red-500">•</span>
                      Numéro de carte, date d'expiration ou CVV incorrect
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-red-500">•</span>
                      Paiement en ligne bloqué par votre banque
                    </li>
                  </ul>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">
                  Vous avez quitté la page de paiement. Aucun montant n'a été débité.
                  Le numéro est toujours disponible si vous souhaitez réessayer.
                </p>
              )}

              <div className="flex flex-col gap-3">
                {phoneId && (
                  <Link href={`/payment?phone_id=${phoneId}`}>
                    <Button className="w-full gap-2" size="lg" data-testid="button-retry">
                      {isDeclined ? "Réessayer avec une autre carte" : "Réessayer le paiement"}
                    </Button>
                  </Link>
                )}
                <Link href="/numbers">
                  <Button variant="outline" className="w-full gap-2" data-testid="button-back-numbers">
                    <ArrowLeft className="h-4 w-4" />
                    Choisir un autre numéro
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
