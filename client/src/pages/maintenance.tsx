import { MessageSquare, Clock, Wrench } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
              <MessageSquare className="h-10 w-10 text-primary" />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
              <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">GWADA SMS</h1>
          <h2 className="text-xl font-semibold text-muted-foreground">Maintenance en cours</h2>
          <p className="text-muted-foreground leading-relaxed">
            Nous effectuons actuellement des opérations de maintenance pour améliorer votre expérience.
            Le service sera de nouveau disponible très bientôt.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-3">
          <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
            <Clock className="h-5 w-5" />
            <span className="font-medium">Durée estimée : quelques minutes</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Merci de votre patience. Pour toute urgence, contactez-nous à{" "}
            <a
              href="mailto:dl.pdf971@gmail.com"
              className="text-primary hover:underline font-medium"
            >
              dl.pdf971@gmail.com
            </a>
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} GWADA SMS — Service de numéros virtuels
        </p>
      </div>
    </div>
  );
}
