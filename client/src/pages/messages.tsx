import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Check, RefreshCw } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SmsMessageCard } from "@/components/sms-message-card";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type PhoneNumberResponse, type SmsMessageResponse } from "@shared/schema";
import { FranceFlag, UsaFlag } from "@/components/flag-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

export default function Messages() {
  const { id } = useParams<{ id: string }>();
  const [copied, setCopied] = useState(false);

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

  const reservation = userReservations?.find(r => r.phoneNumberId === id && r.isActive);

  const telegramMutation = useMutation({
    mutationFn: (chatId: string) => apiRequest("POST", `/api/reservations/${reservation?.id}/telegram`, { chatId }),
    onSuccess: () => {
      toast({ title: "Notifications activées", description: "Vous recevrez désormais vos codes sur Telegram." });
      queryClient.invalidateQueries({ queryKey: ["/api/user/reservations"] });
    },
    onError: (err: Error) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const handleToggleTelegram = () => {
    if (reservation?.telegramChatId) {
      telegramMutation.mutate("");
    } else {
      const chatId = window.prompt("Entrez votre numéro de téléphone (Format: 33612345678) pour recevoir les SMS sur Telegram :\n\nImportant: Vous devez d'abord avoir envoyé /start au bot @GwadasmsBot");
      if (chatId) telegramMutation.mutate(chatId);
    }
  };

  const CountryFlag = phoneNumber?.country === "france" ? FranceFlag : UsaFlag;
  const countryName = phoneNumber?.country === "france" ? "France" : "États-Unis";

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
                    variant={reservation.telegramChatId ? "default" : "outline"}
                    size="sm"
                    onClick={handleToggleTelegram}
                    disabled={telegramMutation.isPending}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {reservation.telegramChatId ? "Notifications Telegram ON" : "Recevoir sur Telegram"}
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
        </div>
      </main>
      <Footer />
    </div>
  );
}
