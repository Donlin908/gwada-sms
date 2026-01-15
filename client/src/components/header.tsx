import { Link, useLocation } from "wouter";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2" data-testid="link-logo">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <MessageSquare className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold" data-testid="text-logo">NuméroSMS</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors ${
              location === "/" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="link-home"
          >
            Accueil
          </Link>
          <Link
            href="/numbers"
            className={`text-sm font-medium transition-colors ${
              location === "/numbers" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="link-numbers"
          >
            Numéros
          </Link>
          <a
            href="#pricing"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            data-testid="link-pricing"
          >
            Tarifs
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/numbers">
            <Button data-testid="button-get-number">
              Obtenir un numéro
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
