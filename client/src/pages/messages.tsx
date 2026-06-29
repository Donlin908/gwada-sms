import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Copy, Check, RefreshCw, Send, MessageCircle, ExternalLink, MessageSquare, Smartphone, TicketCheck } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SmsMessageCard } from "@/components/sms-message-card";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type PhoneNumberResponse, type SmsMessageResponse } from "@shared/schema";
import { FranceFlag, UsaFlag, CanadaFlag } from "@/components/flag-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

function getGuestSessionId(): string {
  return localStorage.getItem("gwada_session_id") ?? "";
}

const SUPPORT_CATEGORIES = [
  { value: "sms_not_received", label: "SMS non reçu" },
  { value: "telegram", label: "Problème Telegram" },
  { value: "payment", label: "Problème de paiement" },
  { value: "wrong_number", label: "Numéro incorrect" },
  { value: "other", label: "Autre" },
];

export default function Messages() {
  const { id } = useParams<{ id: string }>();
  const [copied, setCopied] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [supportCategory, setSupportCategory] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportSent, setSupportSent] = useState(false);

  const { data: phoneNumber, isLoading: isLoadingNumber } = useQuery<PhoneNumberResponse>({
    queryKey: [`/api/numbers/${id}`],
    enabled: !!id && id !== "null",
  });

  const { data: messages, isLoading: isLoadingMessages, refetch, isRefetching } = useQuery<SmsMessageResponse[]>({
    queryKey: [`/api/messages/${id}?sessionId=${encodeURIComponent(getGuestSessionId())}`],
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

  const { data: directReservation } = useQuery<any>({
    queryKey: [`/api/numbers/${id}/active-reservation`],
    enabled: !!id && id !== "null",
  });

  const reservation = userReservations?.find((r: any) => r.phoneNumberId === id && r.isActive) ?? directReservation;

  const { data: telegramLinkData, refetch: refetchTelegramLink } = useQuery<{ deepLink: string; token: string; connected: boolean }>({
    queryKey: [`/api/reservations/${reservation?.id}/telegram-link?sessionId=${encodeURIComponent(getGuestSessionId())}`],
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
    if (reservation?.telegramChatId || reservation?.telegramConnected) setTelegramConnected(true);
  }, [reservation?.telegramChatId, reservation?.telegramConnected]);

  const handleOpenTelegram = () => {
    setTelegramDialogOpen(true);
    if (reservation?.id) refetchTelegramLink();
  };

  const handleCopyCommand = async () => {
    if (telegramLinkData?.token) {
      await navigator.clipboard.writeText(`/start ${telegramLinkData.token}`);
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    }
  };

  const { data: currentUser } = useQuery<any>({ queryKey: ["/api/auth/me"] });
  const isLoggedIn = !!currentUser?.id;

  const supportMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/support/tickets", {
        category: supportCategory,
        message: supportMessage,
        phoneNumber: phoneNumber?.number,
        reservationId: reservation?.id,
        userEmail: isLoggedIn ? undefined : (supportEmail || undefined),
        userName: isLoggedIn ? undefined : (supportName || undefined),
      });
    },
    onSuccess: () => {
      setSupportSent(true);
      toast({ title: "Ticket envoyé !", description: "Nous reviendrons vers vous dans les meilleurs délais." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'envoyer le ticket. Réessayez.", variant: "destructive" });
    },
  });

  const handleSupportClose = () => {
    setSupportDialogOpen(false);
    setTimeout(() => {
      setSupportSent(false);
      setSupportCategory("");
      setSupportMessage("");
      setSupportName("");
      setSupportEmail("");
    }, 300);
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
                    <><Check className="h-4 w-4 text-green-500" />Copié</>
                  ) : (
                    <><Copy className="h-4 w-4" />Copier</>
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
              Si vous ne recevez pas votre code ou si vous avez un problème avec ce numéro, notre support est disponible 7j/7.
            </p>
            <Button
              variant="outline"
              className="w-full max-w-sm gap-2"
              onClick={() => setSupportDialogOpen(true)}
              data-testid="button-support-chat"
            >
              <TicketCheck className="h-4 w-4" />
              Contacter le support
            </Button>
          </div>
        </div>
      </main>
      <Footer />

      {/* ── Dialog Telegram ───────────────────────────────────────────────── */}
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
                : "Ouvrez le bot Telegram puis appuyez sur Démarrer."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {telegramConnected ? (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center space-y-1">
                <p className="text-green-600 dark:text-green-400 font-semibold">✅ Telegram connecté</p>
                <p className="text-sm text-muted-foreground">Vous recevrez tous les SMS sur @GwadasmsBot.</p>
              </div>
            ) : telegramLinkData?.deepLink ? (
              <div className="space-y-4">
                {/* Bouton principal : ouvre l'app Telegram (mobile) */}
                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Smartphone className="h-4 w-4 text-primary" />
                    Sur mobile — application Telegram
                  </div>
                  <Button
                    className="w-full gap-2"
                    data-testid="button-open-telegram"
                    onClick={() => {
                      const token = telegramLinkData.token;
                      window.location.href = `tg://resolve?domain=GwadasmsBot&start=${token}`;
                      setTimeout(() => window.open(telegramLinkData.deepLink, "_blank"), 600);
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ouvrir @GwadasmsBot
                  </Button>
                </div>

                {/* Fallback web : commande à copier-coller */}
                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    Sur Telegram Web — copiez cette commande
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ouvrez <a href="https://t.me/GwadasmsBot" target="_blank" rel="noopener noreferrer" className="underline text-primary">@GwadasmsBot</a> puis envoyez cette commande dans le chat :
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-background border px-3 py-2 text-sm font-mono truncate">
                      /start {telegramLinkData.token}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyCommand}
                      data-testid="button-copy-telegram-command"
                    >
                      {copiedCommand ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  La connexion sera détectée automatiquement après avoir envoyé la commande.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center py-6">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setTelegramDialogOpen(false)} data-testid="button-telegram-close">
              {telegramConnected ? "Fermer" : "Annuler"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Support ────────────────────────────────────────────────── */}
      <Dialog open={supportDialogOpen} onOpenChange={handleSupportClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TicketCheck className="h-5 w-5 text-primary" />
              Contacter le support
            </DialogTitle>
            <DialogDescription>
              Décrivez votre problème, nous vous répondrons dans les meilleurs délais.
            </DialogDescription>
          </DialogHeader>

          {supportSent ? (
            <div className="py-6 text-center space-y-3">
              <div className="text-4xl">✅</div>
              <p className="font-semibold">Ticket envoyé !</p>
              <p className="text-sm text-muted-foreground">
                Notre équipe a été notifiée et reviendra vers vous rapidement.
              </p>
              <Button onClick={handleSupportClose} className="w-full mt-2">Fermer</Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {!isLoggedIn && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="support-name">Votre prénom / nom</Label>
                    <input
                      id="support-name"
                      type="text"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Jean Dupont"
                      value={supportName}
                      onChange={(e) => setSupportName(e.target.value.slice(0, 100))}
                      data-testid="input-support-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="support-email">Votre email</Label>
                    <input
                      id="support-email"
                      type="email"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="vous@exemple.com"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      data-testid="input-support-email"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="support-category">Catégorie du problème</Label>
                <Select value={supportCategory} onValueChange={setSupportCategory}>
                  <SelectTrigger id="support-category" data-testid="select-support-category">
                    <SelectValue placeholder="Choisissez une catégorie..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value} data-testid={`option-support-${c.value}`}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="support-message">
                  Description du problème
                  <span className="ml-2 text-xs text-muted-foreground">({supportMessage.length}/2000)</span>
                </Label>
                <Textarea
                  id="support-message"
                  placeholder="Décrivez votre problème en détail..."
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value.slice(0, 2000))}
                  rows={5}
                  data-testid="textarea-support-message"
                />
              </div>

              {phoneNumber && (
                <div className="rounded-lg bg-muted/40 border px-3 py-2 text-xs text-muted-foreground">
                  Numéro concerné : <span className="font-mono font-medium">{phoneNumber.number}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={handleSupportClose}
                  className="flex-1"
                  data-testid="button-cancel-support"
                >
                  Annuler
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => supportMutation.mutate()}
                  disabled={!supportCategory || supportMessage.length < 10 || supportMutation.isPending}
                  data-testid="button-submit-support"
                >
                  {supportMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    "Envoyer"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
