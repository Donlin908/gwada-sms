import { useState } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Clock, HelpCircle, TicketCheck, RefreshCw } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const SUPPORT_CATEGORIES = [
  { value: "sms_not_received", label: "SMS non reçu" },
  { value: "telegram", label: "Problème Telegram" },
  { value: "payment", label: "Problème de paiement" },
  { value: "wrong_number", label: "Numéro incorrect" },
  { value: "other", label: "Autre" },
];

export default function Contact() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const { data: currentUser } = useQuery<any>({ queryKey: ["/api/auth/me"] });
  const isLoggedIn = !!currentUser?.id;

  const isEmailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const submitMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/support/tickets", {
        category,
        message,
        userEmail: isLoggedIn ? undefined : (email || undefined),
        userName: isLoggedIn ? undefined : (name || undefined),
      });
    },
    onSuccess: () => {
      setSent(true);
      toast({ title: "Ticket envoyé !", description: "Nous vous répondrons dans les meilleurs délais." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'envoyer le ticket. Réessayez.", variant: "destructive" });
    },
  });

  const handleClose = () => {
    setDialogOpen(false);
    setTimeout(() => {
      setSent(false);
      setCategory("");
      setMessage("");
      setName("");
      setEmail("");
    }, 300);
  };

  const faqs = [
    {
      q: "Mon numéro n'a pas reçu de SMS, que faire ?",
      a: "Vérifiez que le numéro est bien activé dans votre tableau de bord. Certains services bloquent les numéros virtuels — dans ce cas, essayez un autre numéro disponible.",
    },
    {
      q: "Puis-je envoyer des SMS avec mon numéro ?",
      a: "Non, nos numéros sont uniquement dédiés à la réception de SMS. L'envoi n'est pas supporté.",
    },
    {
      q: "Que se passe-t-il à l'expiration de ma réservation ?",
      a: "Le numéro est libéré et redevient disponible pour d'autres utilisateurs. Vos messages ne sont plus accessibles.",
    },
    {
      q: "Comment obtenir un remboursement ?",
      a: "En raison de la nature numérique et immédiate du service, les remboursements ne sont possibles qu'en cas de problème technique avéré empêchant l'accès au service.",
    },
    {
      q: "Les SMS sont-ils chiffrés ?",
      a: "Les SMS reçus sont visibles uniquement par vous dans votre tableau de bord. Ils sont supprimés automatiquement à l'expiration de votre réservation.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container px-4 md:px-6">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <h1 className="text-3xl font-bold mb-3">Support & Contact</h1>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Une question ou un problème ? Nous sommes là pour vous aider.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mb-12">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TicketCheck className="h-5 w-5 text-primary" />
                    Ticket support
                  </CardTitle>
                  <CardDescription>Réponse sous 24h (jours ouvrés)</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => setDialogOpen(true)}
                    data-testid="button-contact-ticket"
                  >
                    Ouvrir un ticket
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Horaires de support
                  </CardTitle>
                  <CardDescription>Paris (UTC+1/+2)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Lundi – Vendredi</span>
                    <span className="font-medium text-foreground">8h – 18h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Week-end</span>
                    <span className="font-medium text-foreground">Support limité</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Questions fréquentes
              </h2>
              <div className="space-y-4">
                {faqs.map((faq, i) => (
                  <Card key={i} data-testid={`card-faq-${i}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">{faq.q}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{faq.a}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="mt-10 rounded-xl border bg-muted/30 p-6 text-center">
              <TicketCheck className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Besoin d'aide urgente ?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Pour un problème bloquant votre service actif, décrivez votre situation et notre équipe vous répondra rapidement.
              </p>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(true)}
                data-testid="button-contact-urgent"
              >
                Contacter le support
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {/* ── Dialog ticket support ────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={handleClose}>
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

          {sent ? (
            <div className="py-6 text-center space-y-3">
              <div className="text-4xl">✅</div>
              <p className="font-semibold">Ticket envoyé !</p>
              <p className="text-sm text-muted-foreground">
                {isLoggedIn
                  ? "Notre équipe a été notifiée et vous répondra par email."
                  : email
                  ? <span>Notre réponse sera envoyée à <strong>{email}</strong>.</span>
                  : "Notre équipe a été notifiée et reviendra vers vous rapidement."}
              </p>
              <Button onClick={handleClose} className="w-full mt-2">Fermer</Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {!isLoggedIn && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">Prénom / nom</Label>
                    <input
                      id="contact-name"
                      type="text"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Jean Dupont"
                      value={name}
                      onChange={(e) => setName(e.target.value.slice(0, 100))}
                      data-testid="input-contact-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <input
                      id="contact-email"
                      type="email"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="vous@exemple.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-contact-email"
                    />
                    <p className="text-xs text-muted-foreground">Vous recevrez notre réponse ici</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="contact-category">Catégorie du problème</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="contact-category" data-testid="select-contact-category">
                    <SelectValue placeholder="Choisissez une catégorie..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-message">
                  Description
                  <span className="ml-2 text-xs text-muted-foreground">({message.length}/2000)</span>
                </Label>
                <Textarea
                  id="contact-message"
                  placeholder="Décrivez votre problème en détail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                  rows={5}
                  data-testid="textarea-contact-message"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                  data-testid="button-cancel-contact"
                >
                  Annuler
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => submitMutation.mutate()}
                  disabled={!category || message.length < 10 || submitMutation.isPending || (!isLoggedIn && !isEmailValid(email))}
                  data-testid="button-submit-contact"
                >
                  {submitMutation.isPending ? (
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
