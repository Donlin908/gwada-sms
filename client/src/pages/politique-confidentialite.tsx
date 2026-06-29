import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Shield, Lock, Eye, Mail, Database, Bell, Users, FileText } from "lucide-react";

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="pl-11">{children}</div>
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row gap-1 py-2 border-b last:border-0">
      <span className="font-medium text-sm min-w-[220px] shrink-0">{label}</span>
      <span className="text-muted-foreground text-sm">{value}</span>
    </div>
  );
}

export default function PolitiqueConfidentialite() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-12 md:px-6 max-w-3xl mx-auto">

        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Politique de confidentialité</h1>
          <p className="text-muted-foreground">
            Dernière mise à jour : mai 2026 — Conforme au RGPD (Règlement UE 2016/679)
          </p>
        </div>

        <Section icon={Users} title="1. Responsable du traitement">
          <div className="rounded-lg border p-4 space-y-1 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Entité :</strong> GWADA SMS (SASU)</p>
            <p><strong className="text-foreground">Siège :</strong> 173 rue de Courcelles, 75017 Paris, France</p>
            <p><strong className="text-foreground">Email :</strong>{" "}
              <a href="mailto:contact@gwadasms.com" className="text-primary hover:underline">
                contact@gwadasms.com
              </a>
            </p>
          </div>
        </Section>

        <Section icon={Database} title="2. Données collectées">
          <p className="text-muted-foreground text-sm mb-4">
            Nous collectons uniquement les données strictement nécessaires au fonctionnement du service :
          </p>
          <div className="rounded-lg border overflow-hidden">
            <DataRow label="Adresse email" value="Création de compte, envoi de emails transactionnels" />
            <DataRow label="Mot de passe" value="Stocké chiffré (bcrypt, irréversible) — jamais lu en clair" />
            <DataRow label="Prénom / Nom" value="Optionnel — renseigné via Google OAuth uniquement" />
            <DataRow label="Photo de profil" value="Optionnelle — fournie par Google OAuth si connexion Google" />
            <DataRow label="Réservations" value="Numéro réservé, plan choisi, dates de début et d'expiration" />
            <DataRow label="Identifiant de session" value="Cookie technique de session (httpOnly, Secure)" />
            <DataRow label="Chat Telegram" value="Identifiant de chat (si vous activez les notifications Telegram)" />
            <DataRow label="Données de paiement" value="Traitées exclusivement par Stripe — nous ne les stockons pas" />
          </div>
          <p className="text-muted-foreground text-sm mt-3">
            Les SMS reçus sur les numéros sont temporairement stockés pendant la durée de la réservation pour affichage dans l'interface, puis supprimés automatiquement.
          </p>
        </Section>

        <Section icon={Eye} title="3. Finalités du traitement">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><span className="text-primary font-bold">•</span> Création et gestion de votre compte utilisateur</li>
            <li className="flex gap-2"><span className="text-primary font-bold">•</span> Attribution et gestion des numéros virtuels loués</li>
            <li className="flex gap-2"><span className="text-primary font-bold">•</span> Traitement sécurisé des paiements via Stripe</li>
            <li className="flex gap-2"><span className="text-primary font-bold">•</span> Transmission des SMS reçus vers votre Telegram (si activé)</li>
            <li className="flex gap-2"><span className="text-primary font-bold">•</span> Envoi d'emails de vérification de compte et de notifications de service</li>
            <li className="flex gap-2"><span className="text-primary font-bold">•</span> Prévention des abus, fraudes et utilisation malveillante du service</li>
            <li className="flex gap-2"><span className="text-primary font-bold">•</span> Respect des obligations légales et réglementaires (ARCEP pour la France)</li>
          </ul>
          <div className="mt-4 p-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
            <strong className="text-foreground">Base légale (RGPD art. 6) :</strong> exécution du contrat de service (art. 6.1.b), intérêt légitime pour la sécurité (art. 6.1.f), consentement pour les notifications optionnelles (art. 6.1.a).
          </div>
        </Section>

        <Section icon={Users} title="4. Destinataires des données">
          <p className="text-muted-foreground text-sm mb-4">
            Vos données ne sont <strong>jamais vendues</strong>. Elles peuvent être transmises aux sous-traitants suivants, dans le seul but de fournir le service :
          </p>
          <div className="space-y-3">
            {[
              {
                name: "Stripe",
                role: "Traitement des paiements",
                data: "Données de paiement, email",
                location: "USA (Privacy Shield)",
                link: "https://stripe.com/fr/privacy",
              },
              {
                name: "Twilio",
                role: "Gestion des numéros de téléphone et réception des SMS",
                data: "Numéros de téléphone, contenu des SMS reçus",
                location: "USA (clauses contractuelles types)",
                link: "https://www.twilio.com/en-us/legal/privacy",
              },
              {
                name: "Telegram",
                role: "Transmission des SMS reçus (si activé par l'utilisateur)",
                data: "Contenu des SMS, identifiant de chat Telegram",
                location: "Serveurs Telegram",
                link: "https://telegram.org/privacy",
              },
              {
                name: "Google",
                role: "Authentification OAuth (si connexion Google utilisée)",
                data: "Email, prénom, nom, photo de profil",
                location: "USA (Privacy Shield)",
                link: "https://policies.google.com/privacy",
              },
              {
                name: "Neon (PostgreSQL)",
                role: "Hébergement de la base de données",
                data: "Toutes les données utilisateur stockées",
                location: "USA / EU (selon configuration)",
                link: "https://neon.tech/privacy-policy",
              },
              {
                name: "Sentry",
                role: "Surveillance des erreurs techniques",
                data: "Traces d'erreurs anonymisées (pas de données personnelles)",
                location: "USA",
                link: "https://sentry.io/privacy/",
              },
            ].map((p) => (
              <div key={p.name} className="rounded-lg border p-4 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <strong>{p.name}</strong>
                  <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                    Politique de confidentialité ↗
                  </a>
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <p><span className="text-foreground/70">Rôle :</span> {p.role}</p>
                  <p><span className="text-foreground/70">Données transmises :</span> {p.data}</p>
                  <p><span className="text-foreground/70">Localisation :</span> {p.location}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={Mail} title="5. Méthode de communication">
          <p className="text-muted-foreground text-sm mb-4">
            Nous communiquons avec vous exclusivement via les canaux suivants :
          </p>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3 p-3 rounded-md border">
              <Mail className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Email transactionnel</p>
                <p className="text-muted-foreground">Vérification de compte, confirmation de réservation, alertes de service. Aucun email commercial sans votre consentement explicite.</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 rounded-md border">
              <Bell className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Notifications Telegram (opt-in)</p>
                <p className="text-muted-foreground">Si vous activez cette option, les SMS reçus sur votre numéro sont transmis à votre Telegram. Vous pouvez désactiver à tout moment en libérant votre réservation.</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 rounded-md border">
              <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Interface du site</p>
                <p className="text-muted-foreground">Les SMS reçus sont affichés directement dans votre espace personnel sur le site, accessible via votre compte.</p>
              </div>
            </div>
          </div>
          <p className="text-muted-foreground text-sm mt-3">
            Nous ne vous contacterons jamais par téléphone, SMS ou courrier postal.
          </p>
        </Section>

        <Section icon={Lock} title="6. Mesures de sécurité">
          <div className="space-y-3 text-sm">
            {[
              { label: "Chiffrement des mots de passe", detail: "Algorithme bcrypt avec salt aléatoire — les mots de passe ne sont jamais stockés en clair ni lisibles." },
              { label: "HTTPS obligatoire", detail: "Toutes les communications entre votre navigateur et nos serveurs sont chiffrées (TLS 1.2+)." },
              { label: "Sessions sécurisées", detail: "Cookies de session httpOnly et Secure, régénération de session à chaque connexion." },
              { label: "Paiements PCI-DSS", detail: "Les données bancaires sont traitées exclusivement par Stripe, certifié PCI-DSS niveau 1. Nous ne voyons jamais vos coordonnées bancaires." },
              { label: "Limitation des accès", detail: "Les données de production sont accessibles uniquement au responsable du traitement. Les endpoints d'administration sont protégés par authentification serveur." },
              { label: "Surveillance des erreurs", detail: "Sentry est utilisé pour détecter les anomalies techniques. Les traces d'erreurs sont anonymisées et ne contiennent pas de données personnelles identifiables." },
              { label: "Protection contre les abus", detail: "Limitation du débit (rate limiting) sur toutes les routes sensibles (connexion, paiement, inscription) pour prévenir les attaques par force brute." },
            ].map((item) => (
              <div key={item.label} className="flex gap-3 p-3 rounded-md border">
                <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={Database} title="7. Durée de conservation">
          <div className="rounded-lg border overflow-hidden text-sm">
            <DataRow label="Données de compte" value="Durée de vie du compte + 3 ans après suppression" />
            <DataRow label="Réservations" value="12 mois après expiration de la réservation" />
            <DataRow label="SMS reçus" value="Supprimés à l'expiration de la réservation" />
            <DataRow label="Données de paiement" value="Conservées par Stripe selon leurs obligations légales (5 ans)" />
            <DataRow label="Logs de session" value="30 jours glissants" />
          </div>
        </Section>

        <Section icon={Eye} title="8. Cookies">
          <p className="text-muted-foreground text-sm">
            Le site utilise <strong>un seul cookie</strong> : le cookie de session technique (<code className="text-xs bg-muted px-1 py-0.5 rounded">connect.sid</code>),
            indispensable au maintien de votre connexion. Il est httpOnly, Secure, et expire à la fermeture du navigateur ou après inactivité.
            <br /><br />
            <strong>Aucun cookie publicitaire, de tracking ou analytique</strong> n'est utilisé.
          </p>
        </Section>

        <Section icon={Shield} title="9. Vos droits (RGPD)">
          <p className="text-muted-foreground text-sm mb-3">
            Conformément au RGPD, vous disposez des droits suivants que vous pouvez exercer à tout moment :
          </p>
          <div className="grid sm:grid-cols-2 gap-2 text-sm mb-4">
            {[
              ["Accès", "Obtenir une copie de vos données"],
              ["Rectification", "Corriger des données inexactes"],
              ["Suppression", "Effacer votre compte et vos données"],
              ["Portabilité", "Recevoir vos données dans un format structuré"],
              ["Opposition", "Vous opposer à un traitement"],
              ["Limitation", "Restreindre temporairement un traitement"],
            ].map(([right, desc]) => (
              <div key={right} className="p-3 rounded-md border">
                <p className="font-medium">{right}</p>
                <p className="text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm space-y-2">
            <p>
              <strong>Pour exercer vos droits :</strong>{" "}
              <a href="mailto:contact@gwadasms.com" className="text-primary hover:underline">
                contact@gwadasms.com
              </a>
              {" "}— réponse sous 30 jours maximum.
            </p>
            <p>
              En cas de litige non résolu, vous pouvez déposer une réclamation auprès de la{" "}
              <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                CNIL (Commission Nationale de l'Informatique et des Libertés)
              </a>.
            </p>
          </div>
        </Section>

      </main>
      <Footer />
    </div>
  );
}
