import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function MentionsLegales() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-12 md:px-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Mentions légales</h1>
        <p className="text-muted-foreground mb-10">Dernière mise à jour : février 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Éditeur du site</h2>
          <p className="text-muted-foreground leading-relaxed">
            Le site GWADA SMS est édité par la société GWADA SMS (SASU), dont le siège social est situé au 173 rue de Courcelles, 75017 Paris, France.<br />
            Email de contact : <a href="mailto:dl.pdf971@gmail.com" className="text-primary hover:underline">dl.pdf971@gmail.com</a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Hébergement</h2>
          <p className="text-muted-foreground leading-relaxed">
            Le site est hébergé par :<br />
            <strong>Replit, Inc.</strong><br />
            667 Mission St, San Francisco, CA 94105, États-Unis<br />
            Site : <a href="https://replit.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">replit.com</a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Activité</h2>
          <p className="text-muted-foreground leading-relaxed">
            GWADA SMS est un service de numéros de téléphone virtuels permettant la réception de SMS de vérification.
            Les numéros mis à disposition sont fournis via le prestataire Twilio Inc. Le service est destiné
            à un usage personnel et légal uniquement.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Propriété intellectuelle</h2>
          <p className="text-muted-foreground leading-relaxed">
            L'ensemble du contenu de ce site (textes, graphismes, logo, code source) est la propriété exclusive
            de l'éditeur. Toute reproduction, même partielle, sans autorisation écrite préalable est interdite.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Responsabilité</h2>
          <p className="text-muted-foreground leading-relaxed">
            L'éditeur ne saurait être tenu responsable des dommages directs ou indirects résultant de l'utilisation
            du service. L'utilisateur est seul responsable de l'usage qu'il fait des numéros virtuels mis à sa disposition.
            Le service ne peut être utilisé à des fins illicites, frauduleuses ou contraires aux lois en vigueur.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Droit applicable</h2>
          <p className="text-muted-foreground leading-relaxed">
            Les présentes mentions légales sont régies par le droit français. En cas de litige, et à défaut de
            résolution amiable, les tribunaux français seront seuls compétents.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
