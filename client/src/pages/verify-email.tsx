import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, MailCheck } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token");
  const { user, resendVerification, isResendPending } = useAuth();

  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">(
    token ? "loading" : "no-token"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;

    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Erreur de vérification");
        }
      } catch {
        setStatus("error");
        setErrorMessage("Erreur de connexion au serveur");
      }
    };

    verify();
  }, [token]);

  const handleResend = async () => {
    try {
      await resendVerification();
      setResendSuccess(true);
    } catch {}
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center py-8 md:py-12">
        <div className="container px-4 md:px-6">
          <Card className="mx-auto max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl" data-testid="text-verify-title">
                Vérification de l'email
              </CardTitle>
            </CardHeader>
            <CardContent>
              {status === "loading" && (
                <div className="flex flex-col items-center gap-4 py-8" data-testid="verify-loading">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">Vérification en cours...</p>
                </div>
              )}

              {status === "success" && (
                <div className="flex flex-col items-center gap-4 py-8" data-testid="verify-success">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <h3 className="text-lg font-semibold">Email vérifié avec succès !</h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Votre adresse email a été confirmée. Vous pouvez maintenant profiter de toutes les fonctionnalités.
                  </p>
                  <Button className="w-full" onClick={() => navigate("/dashboard")} data-testid="button-verified-dashboard">
                    Accéder au tableau de bord
                  </Button>
                </div>
              )}

              {status === "error" && (
                <div className="flex flex-col items-center gap-4 py-8" data-testid="verify-error">
                  <XCircle className="h-12 w-12 text-destructive" />
                  <h3 className="text-lg font-semibold">Échec de la vérification</h3>
                  <p className="text-sm text-muted-foreground text-center">{errorMessage}</p>
                  {user && !user.emailVerified && (
                    <div className="w-full space-y-2">
                      {resendSuccess ? (
                        <p className="text-sm text-green-600 text-center">
                          Un nouveau lien a été envoyé !
                        </p>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={handleResend}
                          disabled={isResendPending}
                          data-testid="button-resend-verification"
                        >
                          {isResendPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Envoi...</>
                          ) : (
                            "Renvoyer le lien de vérification"
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                  <Button variant="outline" className="w-full" onClick={() => navigate("/auth")} data-testid="button-back-auth">
                    Retour à la connexion
                  </Button>
                </div>
              )}

              {status === "no-token" && (
                <div className="flex flex-col items-center gap-4 py-8" data-testid="verify-no-token">
                  <MailCheck className="h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Lien invalide</h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Ce lien de vérification n'est pas valide. Connectez-vous et demandez un nouveau lien.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => navigate("/auth")} data-testid="button-back-auth-notoken">
                    Retour à la connexion
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
