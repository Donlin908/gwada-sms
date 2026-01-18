import { Link, useLocation } from "wouter";
import { XCircle, ArrowLeft } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentCancel() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const phoneId = searchParams.get("phone_id");

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center py-8 md:py-12">
        <div className="container px-4 md:px-6">
          <Card className="mx-auto max-w-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle className="text-2xl" data-testid="text-cancel-title">
                Paiement annulé
              </CardTitle>
              <CardDescription>
                Votre paiement n'a pas été effectué
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-center text-muted-foreground">
                Vous avez annulé le paiement. Aucun montant n'a été débité de votre compte.
                Le numéro est toujours disponible si vous souhaitez réessayer.
              </p>

              <div className="flex flex-col gap-3">
                {phoneId && (
                  <Link href={`/payment?phone_id=${phoneId}`}>
                    <Button className="w-full gap-2" size="lg" data-testid="button-retry">
                      Réessayer
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
