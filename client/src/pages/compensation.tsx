import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Phone, Globe, AlertCircle, Loader2, Gift } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CompensationInfo {
  token: string;
  country: string;
  planId: string;
  reason: string;
  expiresAt: string;
  availableNumbers: { id: string; number: string; country: string }[];
}

interface ClaimResult {
  success: boolean;
  reservation: {
    id: string;
    phoneNumber: string;
    phoneNumberId: string;
    expiresAt: string;
  };
}

export default function CompensationPage() {
  const [, params] = useRoute("/compensation/:token");
  const token = params?.token;
  const { toast } = useToast();
  const [selectedNumberId, setSelectedNumberId] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<ClaimResult["reservation"] | null>(null);

  const { data, isLoading, error } = useQuery<CompensationInfo>({
    queryKey: [`/api/compensation/${token}`],
    enabled: !!token,
    retry: false,
  });

  const claimMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/compensation/${token}/claim`, { phoneNumberId: selectedNumberId }),
    onSuccess: (res: ClaimResult) => {
      setClaimed(res.reservation);
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const countryLabel = data?.country === "france" ? "🇫🇷 France (+33)" : "🇺🇸 États-Unis (+1)";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    const msg = (error as Error)?.message || "Lien invalide ou expiré";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Lien invalide</h2>
            <p className="text-muted-foreground">{msg}</p>
            <Button variant="outline" asChild>
              <a href="/">Retour à l'accueil</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (claimed) {
    const expires = new Date(claimed.expiresAt).toLocaleString("fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
    });
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-5">
            <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Numéro attribué !</h2>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground mb-1">Votre nouveau numéro</p>
              <p className="text-2xl font-mono font-bold tracking-wider text-primary" data-testid="text-compensation-number">
                {claimed.phoneNumber}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Valide jusqu'au {expires}</p>
            </div>
            <Button asChild className="w-full" data-testid="button-view-messages">
              <a href={`/messages/${claimed.phoneNumberId}`}>Voir mes SMS</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiresLabel = new Date(data.expiresAt).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-5">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Gift className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Compensation GWADA SMS</h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Suite à un problème technique, choisissez un nouveau numéro <strong>{countryLabel}</strong> gratuitement.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Motif</CardTitle>
            <CardDescription>{data.reason}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Lien valide jusqu'au {expiresLabel}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Choisissez votre nouveau numéro
            </CardTitle>
            <CardDescription>{data.availableNumbers.length} numéro(s) disponible(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.availableNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun numéro disponible pour le moment. Contactez le support.
              </p>
            ) : (
              data.availableNumbers.map((num) => (
                <button
                  key={num.id}
                  onClick={() => setSelectedNumberId(num.id)}
                  className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    selectedNumberId === num.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                  data-testid={`button-select-number-${num.id}`}
                >
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono font-medium">{num.number}</span>
                  </div>
                  <Badge variant="secondary">{num.country === "france" ? "🇫🇷 FR" : "🇺🇸 US"}</Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Button
          className="w-full"
          size="lg"
          disabled={!selectedNumberId || claimMutation.isPending}
          onClick={() => claimMutation.mutate()}
          data-testid="button-claim-compensation"
        >
          {claimMutation.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Attribution en cours…</>
          ) : (
            "Confirmer ce numéro"
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Ce lien est à usage unique. Le numéro vous sera attribué pour 24 heures.
        </p>
      </div>
    </div>
  );
}
