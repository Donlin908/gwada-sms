import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, Clock, HelpCircle } from "lucide-react";

export default function Contact() {
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
                    <Mail className="h-5 w-5 text-primary" />
                    Email
                  </CardTitle>
                  <CardDescription>Réponse sous 24h (jours ouvrés)</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full" data-testid="button-contact-email">
                    <a href="mailto:contact@gwadasms.com?subject=Support GWADA SMS">
                      contact@gwadasms.com
                    </a>
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
              <MessageCircle className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Besoin d'aide urgente ?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Pour un problème bloquant votre service actif, précisez votre numéro de réservation dans votre email.
              </p>
              <Button variant="outline" asChild data-testid="button-contact-urgent">
                <a href="mailto:contact@gwadasms.com?subject=Urgence - Support GWADA SMS">
                  Contacter le support urgent
                </a>
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
