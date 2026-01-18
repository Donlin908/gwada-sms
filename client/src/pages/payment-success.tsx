import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle, MessageSquare, Clock, Loader2 } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

export default function PaymentSuccess() {
  const [location] = useLocation();
  const [, setNavigate] = useLocation();
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  
  const sessionId = searchParams.get("session_id");
  const phoneId = searchParams.get("phone_id");
  const planId = searchParams.get("plan_id");
  const userSession = searchParams.get("user_session");

  const [reservationData, setReservationData] = useState<{
    expiresAt: string;
    message: string;
  } | null>(null);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/confirm-payment", {
        sessionId,
        phoneNumberId: phoneId,
        planId,
        userSessionId: userSession,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setReservationData({
          expiresAt: data.reservation?.expiresAt,
          message: data.message,
        });
      }
    },
  });

  useEffect(() => {
    if (sessionId && phoneId && planId && userSession) {
      confirmMutation.mutate();
    }
  }, [sessionId, phoneId, planId, userSession]);

  const formatExpiryDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (confirmMutation.isPending) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center py-8">
          <Card className="max-w-md text-center">
            <CardContent className="pt-6">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">Confirmation du paiement...</p>
              <p className="text-muted-foreground mt-2">Veuillez patienter</p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (confirmMutation.isError) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center py-8">
          <Card className="max-w-md text-center">
            <CardContent className="pt-6">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <span className="text-2xl text-destructive">!</span>
              </div>
              <p className="text-lg font-medium">Erreur de confirmation</p>
              <p className="text-muted-foreground mt-2">
                Une erreur s'est produite lors de la confirmation de votre paiement.
              </p>
              <Link href="/numbers">
                <Button className="mt-6">Retour aux numéros</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center py-8 md:py-12">
        <div className="container px-4 md:px-6">
          <Card className="mx-auto max-w-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl" data-testid="text-success-title">
                Paiement réussi !
              </CardTitle>
              <CardDescription>
                Votre numéro est maintenant réservé
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {reservationData && (
                <div className="rounded-lg border bg-muted/50 p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Valide jusqu'au</span>
                  </div>
                  <p className="font-medium" data-testid="text-expiry-date">
                    {formatExpiryDate(reservationData.expiresAt)}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Link href={`/messages/${phoneId}`}>
                  <Button className="w-full gap-2" size="lg" data-testid="button-view-messages">
                    <MessageSquare className="h-4 w-4" />
                    Voir mes SMS
                  </Button>
                </Link>
                <Link href="/numbers">
                  <Button variant="outline" className="w-full" data-testid="button-back-numbers">
                    Retour aux numéros
                  </Button>
                </Link>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                Vous pouvez maintenant recevoir des SMS sur ce numéro.
                Actualisez régulièrement pour voir les nouveaux messages.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
