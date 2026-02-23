import { Link, useLocation } from "wouter";
import { MessageSquare, User, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2" data-testid="link-logo">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <MessageSquare className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold" data-testid="text-logo">GWADA SMS</span>
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
          {user && (
            <Link
              href="/dashboard"
              className={`text-sm font-medium transition-colors ${
                location === "/dashboard" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="link-dashboard"
            >
              Mon espace
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" data-testid="button-user-menu">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer" data-testid="menu-dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    Mon espace
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-2 cursor-pointer text-destructive"
                  data-testid="menu-logout"
                >
                  <LogOut className="h-4 w-4" />
                  Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth">
                <Button variant="outline" data-testid="button-header-login">
                  Connexion
                </Button>
              </Link>
              <Link href="/numbers">
                <Button data-testid="button-get-number">
                  Obtenir un numéro
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
