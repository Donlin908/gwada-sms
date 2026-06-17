import { Link } from "wouter";
import { MessageSquare, Lock, Shield, Clock } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container px-4 py-12 md:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4" data-testid="link-footer-logo">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
                <MessageSquare className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold">GWADA SMS</span>
            </Link>
            <p className="max-w-md text-sm text-muted-foreground">
              Service de numéros virtuels (USA &amp; Canada) pour recevoir vos SMS de vérification depuis les DOM-TOM.
              Inscription rapide, paiement sécurisé.
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Liens rapides</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="transition-colors hover:text-foreground" data-testid="link-footer-home">
                  Accueil
                </Link>
              </li>
              <li>
                <Link href="/numbers" className="transition-colors hover:text-foreground" data-testid="link-footer-numbers">
                  Numéros disponibles
                </Link>
              </li>
              <li>
                <a href="#pricing" className="transition-colors hover:text-foreground" data-testid="link-footer-pricing">
                  Tarifs
                </a>
              </li>
              <li>
                <Link href="/contact" className="transition-colors hover:text-foreground" data-testid="link-footer-contact">
                  Support & Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Garanties</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2" data-testid="text-guarantee-secure">
                <Shield className="h-4 w-4 text-primary" />
                Paiement sécurisé
              </li>
              <li className="flex items-center gap-2" data-testid="text-guarantee-privacy">
                <Lock className="h-4 w-4 text-primary" />
                Données privées
              </li>
              <li className="flex items-center gap-2" data-testid="text-guarantee-support">
                <Clock className="h-4 w-4 text-primary" />
                Support réactif
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t pt-6 text-center text-sm text-muted-foreground">
          <div className="flex flex-wrap justify-center gap-4 mb-3">
            <Link href="/mentions-legales" className="transition-colors hover:text-foreground" data-testid="link-footer-mentions">
              Mentions légales
            </Link>
            <Link href="/politique-confidentialite" className="transition-colors hover:text-foreground" data-testid="link-footer-privacy">
              Politique de confidentialité
            </Link>
            <Link href="/cgu" className="transition-colors hover:text-foreground" data-testid="link-footer-cgu">
              CGU
            </Link>
          </div>
          <p>© {new Date().getFullYear()} GWADA SMS. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
