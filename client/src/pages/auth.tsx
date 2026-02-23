import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User, Mail, Lock } from "lucide-react";

export default function Auth() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const { user, login, register, loginError, registerError, isLoginPending, isRegisterPending } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(params.get("mode") === "register");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  if (user) {
    navigate("/dashboard");
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await login(loginEmail, loginPassword);
      navigate("/dashboard");
    } catch {}
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (regPassword !== regConfirm) {
      setLocalError("Les mots de passe ne correspondent pas");
      return;
    }
    try {
      await register(regUsername, regEmail, regPassword);
      navigate("/dashboard");
    } catch {}
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center py-8 md:py-12">
        <div className="container px-4 md:px-6">
          <Card className="mx-auto max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl" data-testid="text-auth-title">
                {isRegisterMode ? "Créer un compte" : "Se connecter"}
              </CardTitle>
              <CardDescription>
                {isRegisterMode
                  ? "Inscrivez-vous pour suivre vos réservations"
                  : "Accédez à votre espace personnel"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isRegisterMode ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="votre@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-10"
                        required
                        data-testid="input-login-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-10"
                        required
                        data-testid="input-login-password"
                      />
                    </div>
                  </div>

                  {loginError && (
                    <p className="text-sm text-destructive" data-testid="text-login-error">{loginError}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoginPending} data-testid="button-login">
                    {isLoginPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connexion...</>
                    ) : (
                      "Se connecter"
                    )}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Pas encore de compte ?{" "}
                    <button
                      type="button"
                      className="text-primary underline-offset-4 hover:underline"
                      onClick={() => { setIsRegisterMode(true); setLocalError(null); }}
                      data-testid="button-switch-register"
                    >
                      S'inscrire
                    </button>
                  </p>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-username">Nom d'utilisateur</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-username"
                        type="text"
                        placeholder="monpseudo"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        className="pl-10"
                        required
                        minLength={3}
                        data-testid="input-reg-username"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="votre@email.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="pl-10"
                        required
                        data-testid="input-reg-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-password"
                        type="password"
                        placeholder="Min. 6 caractères"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="pl-10"
                        required
                        minLength={6}
                        data-testid="input-reg-password"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm">Confirmer le mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-confirm"
                        type="password"
                        placeholder="Confirmez votre mot de passe"
                        value={regConfirm}
                        onChange={(e) => setRegConfirm(e.target.value)}
                        className="pl-10"
                        required
                        minLength={6}
                        data-testid="input-reg-confirm"
                      />
                    </div>
                  </div>

                  {(registerError || localError) && (
                    <p className="text-sm text-destructive" data-testid="text-register-error">
                      {localError || registerError}
                    </p>
                  )}

                  <Button type="submit" className="w-full" disabled={isRegisterPending} data-testid="button-register">
                    {isRegisterPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Inscription...</>
                    ) : (
                      "Créer mon compte"
                    )}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Déjà un compte ?{" "}
                    <button
                      type="button"
                      className="text-primary underline-offset-4 hover:underline"
                      onClick={() => { setIsRegisterMode(false); setLocalError(null); }}
                      data-testid="button-switch-login"
                    >
                      Se connecter
                    </button>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
