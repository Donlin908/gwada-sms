import { Card, CardContent } from "@/components/ui/card";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const faqItems = [
  {
    question: "Le service est-il accessible depuis les DOM-TOM (Guadeloupe, Martinique, Réunion…) ?",
    answer: "Oui, GWADA SMS est pleinement accessible depuis tous les territoires d'outre-mer français : Guadeloupe, Martinique, Réunion, Guyane, Mayotte, Saint-Martin, Saint-Barthélemy et les autres COM/DOM. Le service fonctionne depuis n'importe quelle connexion internet, et les cartes bancaires émises dans les DOM (cartes françaises) sont acceptées via Stripe. La réception des SMS sur les numéros virtuels ne dépend pas de votre localisation."
  },
  {
    question: "Pourquoi je ne peux pas envoyer de SMS ?",
    answer: "Le service est conçu uniquement pour recevoir des codes de vérification. Cela garantit la stabilité du service et évite les abus."
  },
  {
    question: "Quels types de messages sont acceptés ?",
    answer: "Les SMS classiques, notamment les codes de vérification envoyés par les sites et applications pour confirmer votre identité."
  },
  {
    question: "Combien de temps mon numéro reste-t-il actif ?",
    answer: "La durée dépend de la formule choisie : 24 heures pour Basique, 7 jours pour Standard, ou 30 jours pour Premium."
  },
  {
    question: "Puis-je utiliser le même numéro plusieurs fois ?",
    answer: "Un numéro ne peut être utilisé qu'une seule fois par session utilisateur pour garantir la sécurité et éviter les conflits."
  },
  {
    question: "Les messages reçus sont-ils privés ?",
    answer: "Oui, seul vous pouvez voir les messages reçus sur votre numéro réservé pendant la durée de votre réservation."
  },
  {
    question: "Pourquoi je ne vois pas de numéros disponibles ?",
    answer: "Tous les numéros sont peut-être en cours d'utilisation. De nouveaux numéros sont ajoutés régulièrement. Réessayez dans quelques minutes."
  },
  {
    question: "Le service fonctionne-t-il avec tous les sites ?",
    answer: "Notre service fonctionne avec la plupart des sites qui envoient des codes de vérification par SMS. Certains services très sécurisés peuvent bloquer les numéros virtuels."
  }
];

export function FAQSection() {
  return (
    <section className="py-16 px-4 bg-muted/30" data-testid="section-faq">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
            <HelpCircle className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-2" data-testid="text-faq-title">
            Questions fréquentes
          </h2>
          <p className="text-muted-foreground">
            Trouvez rapidement les réponses à vos questions
          </p>
        </div>
        
        <Card>
          <CardContent className="p-0">
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="px-6"
                  data-testid={`faq-item-${index}`}
                >
                  <AccordionTrigger className="text-left hover:no-underline py-4">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
