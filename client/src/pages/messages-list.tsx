import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Phone, Clock, ChevronRight } from "lucide-react";
import { FranceFlag, UsaFlag, CanadaFlag } from "@/components/flag-icons";

interface UserReservation {
  id: string;
  phoneNumberId: string;
  phoneNumber: string;
  country: string;
  planName: string;
  isActive: boolean;
  expiresAt: string;
}

export default function MessagesList() {
  const { data: reservations, isLoading } = useQuery<UserReservation[]>({
    queryKey: ["/api/user/reservations"],
  });

  const activeReservations = reservations?.filter((r) => r.isActive) || [];

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <LoadingSpinner size="lg" text="Chargement..." />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8 md:py-12">
        <div className="container px-4 md:px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Mes Messages</h1>
            <p className="mt-2 text-muted-foreground">
              Consultez les SMS reçus sur vos numéros actifs
            </p>
          </div>

          {activeReservations.length > 0 ? (
            <div className="grid gap-4">
              {activeReservations.map((r) => (
                <Link key={r.id} href={`/messages/${r.phoneNumberId}`}>
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer group">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                            {r.country === "france" ? <FranceFlag /> : r.country === "canada" ? <CanadaFlag /> : <UsaFlag />}
                          </div>
                          <div>
                            <p className="font-mono text-lg font-bold">{r.phoneNumber}</p>
                            <p className="text-sm text-muted-foreground">{r.planName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-muted-foreground">Expire le</p>
                            <p className="text-sm font-medium">
                              {new Date(r.expiresAt).toLocaleDateString("fr-FR")}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <h2 className="text-xl font-semibold mb-2">Aucun message</h2>
                <p className="text-muted-foreground mb-6">
                  Vous n'avez pas de numéro actif pour le moment.
                </p>
                <Link href="/numbers">
                  <Button>Obtenir un numéro</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
