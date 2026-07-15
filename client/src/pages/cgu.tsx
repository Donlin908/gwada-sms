import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function CGU() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-12 md:px-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Conditions Générales d'Utilisation</h1>
        <p className="text-muted-foreground mb-10">Dernière mise à jour : février 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">1. Objet</h2>
          <p className="text-muted-foreground leading-relaxed">
            Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation
            du service GWADA SMS, un service de numéros de téléphone virtuels permettant la réception
            de SMS de vérification. En utilisant le service, vous acceptez sans réserve les présentes CGU.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">2. Description du service</h2>
          <p className="text-muted-foreground leading-relaxed">
            GWADA SMS met à disposition des numéros de téléphone virtuels français (+33) et américains (+1)
            permettant de recevoir des SMS de vérification. Le service est disponible selon trois formules :
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-3">
            <li><strong>Basique (24h) :</strong> 2,00 €</li>
            <li><strong>Standard (7 jours) :</strong> 5,00 €</li>
            <li><strong>Premium (30 jours) :</strong> 9,00 €</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">3. Inscription et compte</h2>
          <p className="text-muted-foreground leading-relaxed">
            L'accès au service nécessite la création d'un compte avec une adresse email valide.
            Vous êtes responsable de la confidentialité de vos identifiants. Toute activité réalisée
            depuis votre compte est sous votre responsabilité. Vous devez être âgé d'au moins 18 ans
            pour utiliser le service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">4. Utilisation autorisée</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Le service est destiné exclusivement à la réception de SMS de vérification pour un usage personnel et légal.
          </p>
          <p className="text-muted-foreground leading-relaxed font-medium">Il est strictement interdit d'utiliser le service pour :</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-2">
            <li>Toute activité frauduleuse ou illégale</li>
            <li>Contourner des systèmes de sécurité de manière malveillante</li>
            <li>Créer de faux comptes sur des plateformes tierces à des fins d'arnaque</li>
            <li>Le spam ou la diffusion de contenus non sollicités</li>
            <li>Toute activité portant atteinte aux droits de tiers</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">5. Paiement et remboursements</h2>
          <p className="text-muted-foreground leading-relaxed">
            Les paiements sont traités de manière sécurisée par Stripe. Les prix sont indiqués en euros TTC.
            Compte tenu de la nature numérique et immédiate du service, <strong>aucun remboursement n'est possible</strong>
            une fois le numéro activé et mis à disposition. En cas de problème technique avéré empêchant l'accès
            au service, contactez-nous à <a href="mailto:contact@gwadasms.com" className="text-primary hover:underline">contact@gwadasms.com</a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">6. Disponibilité du service</h2>
          <p className="text-muted-foreground leading-relaxed">
            GWADA SMS s'efforce d'assurer la disponibilité du service 24h/24 et 7j/7. Toutefois, des
            interruptions peuvent survenir pour maintenance ou en cas de force majeure. La réception
            des SMS dépend également de la disponibilité des réseaux téléphoniques et de nos prestataires de télécommunications partenaires (opérateurs tiers).
            GWADA SMS ne peut garantir la réception de tous les SMS envoyés par des tiers.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">7. Résiliation</h2>
          <p className="text-muted-foreground leading-relaxed">
            GWADA SMS se réserve le droit de suspendre ou supprimer tout compte en cas de violation des
            présentes CGU, sans préavis ni remboursement. L'utilisateur peut supprimer son compte à tout
            moment en contactant le support.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">8. Limitation de responsabilité</h2>
          <p className="text-muted-foreground leading-relaxed">
            GWADA SMS ne peut être tenu responsable des dommages indirects liés à l'utilisation du service,
            notamment l'impossibilité de recevoir un SMS particulier, les délais de livraison des SMS,
            ou l'utilisation du service par des tiers non autorisés.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">9. Modification des CGU</h2>
          <p className="text-muted-foreground leading-relaxed">
            Les présentes CGU peuvent être modifiées à tout moment. Les utilisateurs seront informés
            par email en cas de modification substantielle. La poursuite de l'utilisation du service
            après modification vaut acceptation des nouvelles CGU.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">10. Droit applicable</h2>
          <p className="text-muted-foreground leading-relaxed">
            Les présentes CGU sont soumises au droit français. Tout litige sera soumis à la compétence
            exclusive des tribunaux de Paris, sauf disposition légale contraire.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
