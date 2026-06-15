import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Check, RefreshCw, Send, MessageCircle, ExternalLink, MessageSquare } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SmsMessageCard } from "@/components/sms-message-card";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type PhoneNumberResponse, type SmsMessageResponse } from "@shared/schema";
import { FranceFlag, UsaFlag, CanadaFlag } from "@/components/flag-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Messages() {
  const { id } = useParams<{ id: string }>();
  const [copied, setCopied] = useState(false);
  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);

  const { data: phoneNumber, isLoading: isLoadingNumber } = useQuery<PhoneNumberResponse>({
    queryKey: [`/api/numbers/${id}`],
    enabled: !!id && id !== "null",
  });

  const { data: messages, isLoading: isLoadingMessages, refetch, isRefetching } = useQuery<SmsMessageResponse[]>({
    queryKey: [`/api/messages/${id}`],
    refetchInterval: 10000,
    enabled: !!id && id !== "null",
  });

  const handleCopy = async () => {
    if (phoneNumber) {
      await navigator.clipboard.writeText(phoneNumber.number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: userReservations } = useQuery<any[]>({
    queryKey: ["/api/user/reservations"],
  });

  // Fallback : réservation active directement sur ce numéro (si non connecté ou session guest)
  const { data: directReservation } = useQuery<any>({
    queryKey: [`/api/numbers/${id}/active-reservation`],
    enabled: !!id && id !== "null",
  });

  const reservation = userReservations?.find((r: any) => r.phoneNumberId === id && r.isActive) ?? directReservation;

  const { data: telegramLinkData, refetch: refetchTelegramLink } = useQuery<{ deepLink: string; token: string; connected: boolean }>({
    queryKey: [`/api/reservations/${reservation?.id}/telegram-link`],
    enabled: !!reservation?.id && telegramDialogOpen,
    refetchInterval: telegramDialogOpen && !telegramConnected ? 3000 : false,
  });

  useEffect(() => {
    if (telegramLinkData?.connected && !telegramConnected) {
      setTelegramConnected(true);
      queryClient.invalidateQueries({ queryKey: ["/api/user/reservations"] });
      toast({ title: "Telegram connecté !", description: "Vous recevrez vos SMS directement dans Telegram." });
    }
  }, [telegramLinkData?.connected, telegramConnected, queryClient, toast]);

  useEffect(() => {
    if (reservation?.telegramChatId) setTelegramConnected(true);
  }, [reservation?.telegramChatId]);

  const handleOpenTelegram = () => {
    setTelegramDialogOpen(true);
    if (reservation?.id) refetchTelegramLink();
  };

  const CountryFlag = phoneNumber?.country === "france" ? FranceFlag : phoneNumber?.country === "canada" ? CanadaFlag : UsaFlag;
  const countryName = phoneNumber?.country === "france" ? "France" : phoneNumber?.country === "canada" ? "Canada" : "États-Unis";

  if (isLoadingNumber) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <LoadingSpinner size="lg" text="Chargement..." />
        </main>
        <Footer />
      </div>
    );
  }

  if (!phoneNumber) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-bold">Numéro non trouvé</h1>
          <p className="text-muted-foreground">Ce numéro n'existe pas ou n'est plus disponible.</p>
          <Link href="/numbers">
            <Button>Retour aux numéros</Button>
          </Link>
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
          <Link href="/numbers" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground" data-testid="link-back-numbers">
            <ArrowLeft className="h-4 w-4" />
            Retour aux numéros
          </Link>

          <Card className="mb-8">
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap pb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <CountryFlag className="h-8 w-8" />
                <div>
                  <div className="font-mono text-2xl font-bold" data-testid="text-current-number">
                    {phoneNumber.number}
                  </div>
                  <p className="text-sm text-muted-foreground">{countryName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400" data-testid="badge-active">
                  Actif
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2"
                  data-testid="button-copy-number"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      Copié
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copier
                    </>
                  )}
                </Button>
                {reservation && (
                  <Button
                    variant={telegramConnected ? "default" : "outline"}
                    size="sm"
                    onClick={handleOpenTelegram}
                    className="gap-2"
                    data-testid="button-telegram"
                  >
                    <Send className="h-4 w-4" />
                    {telegramConnected ? "Telegram activé ✓" : "Recevoir sur Telegram"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Utilisez ce numéro pour recevoir vos SMS de vérification. Les messages apparaîtront automatiquement ci-dessous.
              </p>
            </CardContent>
          </Card>

          <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-semibold" data-testid="text-messages-title">
              Messages reçus
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="gap-2"
              data-testid="button-refresh-messages"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>

          {isLoadingMessages ? (
            <div className="py-16">
              <LoadingSpinner size="lg" text="Chargement des messages..." />
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((message) => (
                <SmsMessageCard key={message.id} message={message} />
              ))}
            </div>
          ) : (
            <EmptyState type="messages" />
          )}

          <div className="mt-12 flex flex-col items-center gap-4 border-t pt-8 relative z-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Besoin d'aide ?</span>
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Si vous ne recevez pas votre code ou si vous avez un problème avec ce numéro, notre support est disponible 7j/7 sur Telegram.
            </p>
            <Button
              variant="outline"
              className="w-full max-w-sm gap-2 border-[#0088cc] text-[#0088cc] hover:bg-[#0088cc]/10"
              onClick={() => setSupportDialogOpen(true)}
              data-testid="button-support-chat"
            >
              <MessageSquare className="h-4 w-4" />
              Contacter le support (Telegram)
            </Button>
          </div>
        </div>
      </main>
      <Footer />

      <Dialog open={telegramDialogOpen} onOpenChange={setTelegramDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Recevoir vos SMS sur Telegram
            </DialogTitle>
            <DialogDescription>
              {telegramConnected
                ? "Vos SMS sont transmis automatiquement sur Telegram."
                : "Ouvrez le bot Telegram ci-dessous — la connexion se fait en un clic."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {telegramConnected ? (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center space-y-1">
                <p className="text-green-600 dark:text-green-400 font-semibold">✅ Telegram connecté</p>
                <p className="text-sm text-muted-foreground">Vous recevrez tous les SMS sur @GwadasmsBot.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Cliquez sur le bouton ci-dessous pour ouvrir <b>@GwadasmsBot</b> dans Telegram, puis appuyez sur <b>Démarrer</b>.
                  </p>
                  {telegramLinkData?.deepLink ? (
                    <Button
                      asChild
                      className="w-full gap-2"
                      data-testid="button-open-telegram"
                    >
                      <a href={telegramLinkData.deepLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Ouvrir @GwadasmsBot
                      </a>
                    </Button>
                  ) : (
                    <div className="flex items-center justify-center py-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  La connexion sera détectée automatiquement après votre clic sur Démarrer.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setTelegramDialogOpen(false)}
              data-testid="button-telegram-close"
            >
              {telegramConnected ? "Fermer" : "Annuler"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={supportDialogOpen} onOpenChange={setSupportDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" style={{ color: "#0088cc" }} />
              Contacter le support
            </DialogTitle>
            <DialogDescription>
              Vous allez être redirigé vers notre bot Telegram <b>@GwadasmsBot</b> pour discuter avec notre équipe de support, disponible 7j/7.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <a
              href="https://t.me/GwadasmsBot"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setSupportDialogOpen(false)}
              className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium h-10 px-4 py-2 text-white no-underline"
              style={{ backgroundColor: "#0088cc" }}
              data-testid="button-open-support-telegram"
            >
              <ExternalLink className="h-4 w-4" />
              Ouvrir Telegram
            </a>
            <Button
              variant="outline"
              onClick={() => setSupportDialogOpen(false)}
              data-testid="button-cancel-support"
            >
              Annuler
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
