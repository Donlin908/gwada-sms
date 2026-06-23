import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, Clock, MessageSquare, Plus, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { FranceFlag, UsaFlag, CanadaFlag } from "@/components/flag-icons";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UserReservation {
  id: string;
  phoneNumberId: string;
  phoneNumber: string;
  country: string;
  planName: string;
  planDuration: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

export default function Dashboard() {
  const { user, isLoading: authLoading, resendVerification, isResendPending } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: reservations, isLoading: reservationsLoading } = useQuery<UserReservation[]>({
    queryKey: ["/api/user/reservations"],
    queryFn: async () => {
      const res = await fetch("/api/user/reservations", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    enabled: !!user,
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/user/account");
    },
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
      setShowDeleteDialog(false);
    },
  });

  if (authLoading) {
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

  if (!user) {
    navigate("/auth");
    return null;
  }

  const activeReservations = reservations?.filter((r) => r.isActive) || [];
  const pastReservations = reservations?.filter((r) => !r.isActive) || [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expiré";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}j ${hours % 24}h restantes`;
    return `${hours}h restantes`;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8 md:py-12">
        <div className="container px-4 md:px-6">
          {user && !user.emailVerified && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950" data-testid="banner-verify-email">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Votre email n'est pas encore vérifié. Vérifiez votre boîte mail pour activer votre compte.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resendVerification()}
                disabled={isResendPending}
                data-testid="button-dashboard-resend"
              >
                {isResendPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Renvoyer"}
              </Button>
            </div>
          )}

          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">
                Bonjour, {user.username}
              </h1>
              <p className="mt-2 text-muted-foreground">
                Gérez vos numéros et suivez vos réservations
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 gap-2 mt-1"
              onClick={() => setShowDeleteDialog(true)}
              data-testid="button-delete-account"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer le compte
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <Card>
              <CardContent className="pt-6 text-center">
                <Phone className="mx-auto h-8 w-8 text-primary mb-2" />
                <p className="text-2xl font-bold" data-testid="text-active-count">{activeReservations.length}</p>
                <p className="text-sm text-muted-foreground">Numéros actifs</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Clock className="mx-auto h-8 w-8 text-orange-500 mb-2" />
                <p className="text-2xl font-bold" data-testid="text-total-count">{reservations?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total réservations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex flex-col items-center justify-center">
                <Link href="/numbers">
                  <Button className="gap-2" data-testid="button-new-number">
                    <Plus className="h-4 w-4" />
                    Nouveau numéro
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {reservationsLoading ? (
            <LoadingSpinner text="Chargement des réservations..." />
          ) : (
            <>
              {activeReservations.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold mb-4" data-testid="text-active-section">
                    Numéros actifs
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {activeReservations.map((r) => (
                      <Card key={r.id} className="border-green-200 dark:border-green-800" data-testid={`card-reservation-${r.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 flex items-center justify-center">
                                {r.country === "france" ? <FranceFlag /> : r.country === "canada" ? <CanadaFlag /> : <UsaFlag />}
                              </div>
                              <div>
                                <CardTitle className="text-lg" data-testid={`text-phone-${r.id}`}>{r.phoneNumber}</CardTitle>
                                <CardDescription>{r.planName} - {r.planDuration}</CardDescription>
                              </div>
                            </div>
                            <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-0">
                              Actif
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                              <Clock className="inline h-3 w-3 mr-1" />
                              {getTimeRemaining(r.expiresAt)}
                            </p>
                            <Link href={`/messages/${r.phoneNumberId}`}>
                              <Button variant="outline" size="sm" className="gap-1" data-testid={`button-messages-${r.id}`}>
                                <MessageSquare className="h-3 w-3" />
                                SMS
                              </Button>
                            </Link>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Expire le {formatDate(r.expiresAt)}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {pastReservations.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4" data-testid="text-history-section">
                    Historique
                  </h2>
                  <div className="grid gap-3">
                    {pastReservations.map((r) => (
                      <Card key={r.id} className="opacity-60" data-testid={`card-past-${r.id}`}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-6 w-6 flex items-center justify-center">
                                {r.country === "france" ? <FranceFlag /> : r.country === "canada" ? <CanadaFlag /> : <UsaFlag />}
                              </div>
                              <div>
                                <p className="font-medium">{r.phoneNumber}</p>
                                <p className="text-xs text-muted-foreground">{r.planName}</p>
                              </div>
                            </div>
                            <Badge variant="secondary">Expiré</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {(!reservations || reservations.length === 0) && (
                <Card className="text-center">
                  <CardContent className="pt-8 pb-8">
                    <Phone className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-lg font-medium mb-2">Aucune réservation</p>
                    <p className="text-muted-foreground mb-4">
                      Commencez par réserver un numéro virtuel
                    </p>
                    <Link href="/numbers">
                      <Button data-testid="button-get-first-number">Obtenir un numéro</Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent data-testid="dialog-delete-account">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Supprimer le compte
            </DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Votre compte et toutes vos réservations seront définitivement supprimés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              data-testid="button-cancel-delete"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteAccountMutation.mutate()}
              disabled={deleteAccountMutation.isPending}
              data-testid="button-confirm-delete-account"
            >
              {deleteAccountMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Oui, supprimer mon compte"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
