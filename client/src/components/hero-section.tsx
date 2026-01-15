import { Link } from "wouter";
import { ArrowRight, Clock, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FranceFlag, UsaFlag } from "./flag-icons";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-20 md:py-28">
      <div className="container px-4 md:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
            </span>
            <span className="text-muted-foreground" data-testid="text-live-indicator">10 000+ SMS reçus aujourd'hui</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl" data-testid="text-hero-title">
            Recevez vos SMS{" "}
            <span className="text-primary">instantanément</span>
          </h1>

          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl" data-testid="text-hero-description">
            Obtenez un numéro français ou américain pour recevoir vos codes de vérification. 
            Sans inscription, sans engagement.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/numbers?country=france">
              <Button size="lg" className="gap-2" data-testid="button-france">
                <FranceFlag className="h-5 w-5" />
                Numéro France
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/numbers?country=usa">
              <Button size="lg" variant="outline" className="gap-2" data-testid="button-usa">
                <UsaFlag className="h-5 w-5" />
                Numéro États-Unis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-3">
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 text-center hover-elevate" data-testid="card-feature-instant">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold" data-testid="text-feature-instant">Réception en moins de 30s</h3>
            <p className="text-sm text-muted-foreground">
              Vos SMS arrivent instantanément sur votre tableau de bord
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 text-center hover-elevate" data-testid="card-feature-anonymous">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold" data-testid="text-feature-anonymous">100% Anonyme</h3>
            <p className="text-sm text-muted-foreground">
              Aucune inscription requise, vos données restent privées
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 text-center hover-elevate" data-testid="card-feature-auto">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold" data-testid="text-feature-auto">Expiration auto</h3>
            <p className="text-sm text-muted-foreground">
              Pas d'engagement, le numéro expire automatiquement
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
