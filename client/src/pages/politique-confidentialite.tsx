import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function PolitiqueConfidentialite() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-12 md:px-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Politique de confidentialité</h1>
        <p className="text-muted-foreground mb-10">Dernière mise à jour : février 2026 — Conforme au RGPD</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">1. Responsable du traitement</h2>
          <p className="text-muted-foreground leading-relaxed">
            Le responsable du traitement des données personnelles est l'éditeur du site GWADA SMS,
            établi en Guadeloupe (971), France.<br />
            Contact : <a href="mailto:dl.pdf971@gmail.com" className="text-primary hover:underline">dl.pdf971@gmail.com</a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">2. Données collectées</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Nous collectons uniquement les données nécessaires au fonctionnement du service :
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li><strong>Compte utilisateur :</strong> adresse email, mot de passe (chiffré), prénom, nom</li>
            <li><strong>Réservations :</strong> numéro réservé, durée, date de début et d'expiration</li>
            <li><strong>Paiements :</strong> traités par Stripe — nous ne stockons aucune donnée bancaire</li>
            <li><strong>Connexion Google :</strong> email, prénom, nom, photo de profil (via Google OAuth)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">3. Finalités du traitement</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Création et gestion de votre compte</li>
            <li>Fourniture du service de numéros virtuels</li>
            <li>Traitement des paiements</li>
            <li>Envoi d'emails de vérification de compte</li>
            <li>Prévention des abus et sécurité du service</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">4. Base légale</h2>
          <p className="text-muted-foreground leading-relaxed">
            Le traitement de vos données repose sur l'exécution du contrat de service (article 6.1.b du RGPD)
            et, pour l'envoi d'emails, votre consentement lors de l'inscription.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">5. Durée de conservation</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li><strong>Données de compte :</strong> conservées tant que le compte est actif</li>
            <li><strong>Réservations :</strong> 12 mois après expiration</li>
            <li><strong>Messages SMS :</strong> supprimés automatiquement après expiration de la réservation</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">6. Partage des données</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Vos données ne sont jamais vendues. Elles peuvent être partagées avec :
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li><strong>Stripe</strong> (paiements) — <a href="https://stripe.com/fr/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">politique de confidentialité</a></li>
            <li><strong>Twilio</strong> (numéros de téléphone) — <a href="https://www.twilio.com/en-us/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">politique de confidentialité</a></li>
            <li><strong>Google</strong> (connexion OAuth) — uniquement si vous utilisez "Se connecter avec Google"</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">7. Vos droits (RGPD)</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Conformément au RGPD, vous disposez des droits suivants :
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li><strong>Accès</strong> à vos données personnelles</li>
            <li><strong>Rectification</strong> des données inexactes</li>
            <li><strong>Suppression</strong> de votre compte et de vos données</li>
            <li><strong>Portabilité</strong> de vos données</li>
            <li><strong>Opposition</strong> au traitement</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-3">
            Pour exercer ces droits, contactez-nous à : <a href="mailto:dl.pdf971@gmail.com" className="text-primary hover:underline">dl.pdf971@gmail.com</a><br />
            Vous pouvez également introduire une réclamation auprès de la <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">CNIL</a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">8. Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            Le site utilise uniquement un cookie de session technique, nécessaire au fonctionnement du service
            (maintien de la connexion). Aucun cookie publicitaire ou de tracking n'est utilisé.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">9. Sécurité</h2>
          <p className="text-muted-foreground leading-relaxed">
            Les mots de passe sont chiffrés (bcrypt). Les communications sont sécurisées par HTTPS.
            Les données de paiement sont traitées exclusivement par Stripe (certifié PCI-DSS).
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
