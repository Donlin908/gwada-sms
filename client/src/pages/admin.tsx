import { useQuery, useMutation } from "@tanstack/react-query";
import type { Review } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { 
  Phone, 
  Settings, 
  RefreshCw, 
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  BarChart2,
  Lock,
  LogOut,
  TrendingUp,
  DollarSign,
  Users,
  Send,
  MessageSquare,
  Gift,
  Copy,
  Link2,
  Star,
  Trash2
} from "lucide-react";

interface AdminStats {
  totalNumbers: number;
  franceNumbers: number;
  usaNumbers: number;
  numbersAtLimit: number;
  totalUsage: number;
  alertsSent: number;
  numbersPurchased: number;
  numbersSynced: number;
  numbersInvalidated: number;
  lastSyncAt: string | null;
  settings: {
    usageAlertThreshold: number;
    autoPurchaseEnabled: boolean;
    minNumbersPerCountry: number;
    maxUsagesDaily: number;
    maxUsagesWeekly: number;
    maxUsagesMonthly: number;
    franceBundleRequired: boolean;
    maintenanceMode: boolean;
  };
  services: {
    emailConfigured: boolean;
    twilioConfigured: boolean;
  };
}

interface AdminUser {
  id: string;
  username: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  email_verified: boolean;
  auth_provider: string | null;
  created_at: string;
}

interface AdminNumber {
  id: string;
  number: string;
  country: string;
  usageCount: number;
  isAvailable: boolean;
  isValid: boolean;
  twilioActive: boolean;
  lastTwilioCheck: string | null;
  maxUsageDaily: number;
  maxUsageWeekly: number;
  maxUsageMonthly: number;
  availabilityByPlan: { daily: boolean; weekly: boolean; monthly: boolean };
  createdAt: string;
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  description?: string;
}) {
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ServiceStatus({ name, configured }: { name: string; configured: boolean }) {
  return (
    <div className="flex items-center justify-between py-2" data-testid={`service-status-${name.toLowerCase()}`}>
      <span className="text-sm font-medium">{name}</span>
      {configured ? (
        <Badge variant="default" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Configuré
        </Badge>
      ) : (
        <Badge variant="secondary" className="gap-1">
          <XCircle className="h-3 w-3" />
          Non configuré
        </Badge>
      )}
    </div>
  );
}

const COST_PER_NUMBER = 1.05;
const MONTHLY_COST = 1.05;

const PRICING_PLANS = [
  { name: "Basique", price: 2, duration: "24h" },
  { name: "Standard", price: 5, duration: "7 jours" },
  { name: "Premium", price: 9, duration: "30 jours" },
];

function ProfitabilityTable({ 
  totalNumbers, 
  totalUsage, 
  usageThreshold 
}: { 
  totalNumbers: number; 
  totalUsage: number;
  usageThreshold: number;
}) {
  const monthlyCostPerNumber = COST_PER_NUMBER + MONTHLY_COST;
  const totalMonthlyCost = totalNumbers * monthlyCostPerNumber;
  
  const calculateProfit = (pricePerUse: number, uses: number) => {
    return (pricePerUse * uses) - monthlyCostPerNumber;
  };
  
  const calculateROI = (revenue: number, cost: number) => {
    if (cost === 0) return 0;
    return ((revenue - cost) / cost) * 100;
  };

  return (
    <Card data-testid="card-profitability">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Tableau de rentabilité
        </CardTitle>
        <CardDescription>
          Analyse financière basée sur le coût Twilio de {COST_PER_NUMBER}€ + {MONTHLY_COST}€/mois par numéro
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="text-sm text-muted-foreground">Coût mensuel total</div>
            <div className="text-2xl font-bold text-destructive">
              {totalMonthlyCost.toFixed(2)} €
            </div>
            <div className="text-xs text-muted-foreground">
              {totalNumbers} numéros × {monthlyCostPerNumber.toFixed(2)}€
            </div>
          </div>
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="text-sm text-muted-foreground">Utilisations totales</div>
            <div className="text-2xl font-bold">{totalUsage}</div>
            <div className="text-xs text-muted-foreground">
              Moyenne: {totalNumbers > 0 ? (totalUsage / totalNumbers).toFixed(1) : 0} par numéro
            </div>
          </div>
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="text-sm text-muted-foreground">Seuil de remplacement</div>
            <div className="text-2xl font-bold">{usageThreshold}</div>
            <div className="text-xs text-muted-foreground">
              utilisations par numéro
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Rentabilité par formule (sur {usageThreshold} utilisations)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Formule</th>
                  <th className="text-right py-2 px-3">Prix</th>
                  <th className="text-right py-2 px-3">Revenu potentiel</th>
                  <th className="text-right py-2 px-3">Coût</th>
                  <th className="text-right py-2 px-3">Profit net</th>
                  <th className="text-right py-2 px-3">Marge</th>
                  <th className="text-right py-2 px-3">ROI</th>
                </tr>
              </thead>
              <tbody>
                {PRICING_PLANS.map((plan) => {
                  const revenue = plan.price * usageThreshold;
                  const profit = revenue - monthlyCostPerNumber;
                  const margin = (profit / revenue) * 100;
                  const roi = calculateROI(revenue, monthlyCostPerNumber);
                  
                  return (
                    <tr key={plan.name} className="border-b hover-elevate">
                      <td className="py-3 px-3">
                        <div className="font-medium">{plan.name}</div>
                        <div className="text-xs text-muted-foreground">{plan.duration}</div>
                      </td>
                      <td className="text-right py-3 px-3 font-mono">{plan.price} €</td>
                      <td className="text-right py-3 px-3 font-mono font-medium">
                        {revenue.toFixed(0)} €
                      </td>
                      <td className="text-right py-3 px-3 font-mono text-destructive">
                        {monthlyCostPerNumber.toFixed(2)} €
                      </td>
                      <td className="text-right py-3 px-3 font-mono font-bold text-green-600 dark:text-green-400">
                        {profit.toFixed(2)} €
                      </td>
                      <td className="text-right py-3 px-3">
                        <Badge variant="default">{margin.toFixed(1)}%</Badge>
                      </td>
                      <td className="text-right py-3 px-3">
                        <Badge variant="secondary">{roi.toFixed(0)}%</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Métriques par utilisateur
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Formule</th>
                  <th className="text-right py-2 px-3">Revenu/user</th>
                  <th className="text-right py-2 px-3">Coût/user</th>
                  <th className="text-right py-2 px-3">Profit/user</th>
                  <th className="text-right py-2 px-3">Coût % du prix</th>
                </tr>
              </thead>
              <tbody>
                {PRICING_PLANS.map((plan) => {
                  const costPerUser = monthlyCostPerNumber / usageThreshold;
                  const profitPerUser = plan.price - costPerUser;
                  const costPercentage = (costPerUser / plan.price) * 100;
                  
                  return (
                    <tr key={plan.name} className="border-b hover-elevate">
                      <td className="py-3 px-3">
                        <div className="font-medium">{plan.name}</div>
                        <div className="text-xs text-muted-foreground">{plan.duration}</div>
                      </td>
                      <td className="text-right py-3 px-3 font-mono">{plan.price.toFixed(2)} €</td>
                      <td className="text-right py-3 px-3 font-mono text-destructive">
                        {costPerUser.toFixed(4)} €
                      </td>
                      <td className="text-right py-3 px-3 font-mono font-bold text-green-600 dark:text-green-400">
                        {profitPerUser.toFixed(4)} €
                      </td>
                      <td className="text-right py-3 px-3">
                        <Badge variant={costPercentage < 1 ? "default" : "secondary"}>
                          {costPercentage.toFixed(2)}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Coût par utilisateur = Coût mensuel du numéro ({monthlyCostPerNumber.toFixed(2)}€) ÷ Seuil d'utilisation ({usageThreshold})
          </p>
        </div>

        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/20">
          <h4 className="font-semibold mb-2 text-green-700 dark:text-green-400">Seuil de rentabilité</h4>
          <div className="grid gap-2 md:grid-cols-3 text-sm">
            {PRICING_PLANS.map((plan) => {
              const breakEven = Math.ceil(monthlyCostPerNumber / plan.price);
              return (
                <div key={plan.name} className="flex justify-between">
                  <span>{plan.name} ({plan.price}€)</span>
                  <span className="font-mono font-medium">{breakEven} utilisation{breakEven > 1 ? 's' : ''}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Nombre minimum d'utilisations pour couvrir le coût mensuel d'un numéro
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", "/api/admin/login", { password });
      if (response.ok) {
        sessionStorage.setItem("adminAuth", "true");
        onLogin();
        toast({ title: "Connexion réussie" });
      }
    } catch (error) {
      toast({ title: "Mot de passe incorrect", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Administration</CardTitle>
          <CardDescription>Entrez le code d'accès pour continuer</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Code d'accès</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Entrez le code..."
                data-testid="input-admin-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !password}
              data-testid="button-admin-login"
            >
              {isLoading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("adminAuth") === "true";
  });
  
  const [usageThreshold, setUsageThreshold] = useState(100);
  const [autoPurchaseEnabled, setAutoPurchaseEnabled] = useState(false);
  const [minPerCountry, setMinPerCountry] = useState(3);
  const [maxUsagesDaily, setMaxUsagesDaily] = useState(20);
  const [maxUsagesWeekly, setMaxUsagesWeekly] = useState(10);
  const [maxUsagesMonthly, setMaxUsagesMonthly] = useState(5);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  
  const handleLogout = () => {
    sessionStorage.removeItem("adminAuth");
    setIsAuthenticated(false);
  };
  
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });
  
  const { data: numbers, isLoading: numbersLoading } = useQuery<AdminNumber[]>({
    queryKey: ["/api/admin/numbers"],
    enabled: isAuthenticated,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<{ users: AdminUser[] }>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated,
  });

  const { data: telegramStatus } = useQuery<{ configured: boolean; chatId: string | null; botToken: string | null }>({
    queryKey: ["/api/admin/telegram/status"],
    enabled: isAuthenticated,
  });

  const testTelegramMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/telegram/test"),
    onSuccess: () => toast({ title: "✅ Message Telegram envoyé", description: "Vérifiez votre conversation Telegram." }),
    onError: () => toast({ title: "❌ Échec Telegram", description: "Vérifiez TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID.", variant: "destructive" }),
  });

  const dailyReportMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/telegram/daily-report"),
    onSuccess: () => toast({ title: "📊 Rapport journalier envoyé", description: "Vérifiez votre Telegram." }),
    onError: () => toast({ title: "❌ Échec du rapport", description: "Vérifiez la configuration Telegram.", variant: "destructive" }),
  });

  const testSmsMutation = useMutation({
    mutationFn: (phoneNumberId: string) => apiRequest("POST", "/api/admin/test-sms", { phoneNumberId }),
    onSuccess: () => {
      toast({ title: "✅ SMS de test généré", description: "Le message a été ajouté et envoyé sur Telegram." });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
    onError: (err: Error) => toast({ title: "❌ Échec SMS", description: err.message, variant: "destructive" }),
  });

  const { data: basiqueData, isLoading: basiqueLoading, refetch: refetchBasique } = useQuery<{
    reservations: {
      reservationId: string;
      phoneNumber: string;
      phoneNumberId: string | null;
      country: string;
      isProblematic: boolean;
      userEmail: string | null;
      expiresAt: string;
      hasActiveCompensation: boolean;
      compensationLink: string | null;
    }[];
    problematicCount: number;
  }>({
    queryKey: ["/api/admin/compensation/basique-reservations"],
    enabled: isAuthenticated,
  });

  const [generatedLink, setGeneratedLink] = useState<{ link: string; telegramLink?: string; reservationId: string } | null>(null);
  const [compensationReason, setCompensationReason] = useState("Problème de réception SMS");

  const markProblematicMutation = useMutation({
    mutationFn: ({ phoneNumberId, isProblematic }: { phoneNumberId: string; isProblematic: boolean }) =>
      apiRequest("POST", `/api/admin/numbers/${phoneNumberId}/problematic`, { isProblematic }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/compensation/basique-reservations"] });
      toast({ title: "Statut mis à jour" });
    },
    onError: (err: Error) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const generateCompensationMutation = useMutation({
    mutationFn: ({ reservationId, reason, sendToTelegram }: { reservationId: string; reason: string; sendToTelegram?: boolean }) =>
      apiRequest("POST", "/api/admin/compensation/generate", { reservationId, reason, sendToTelegram }),
    onSuccess: (data: { link: string; telegramLink: string; token: string; sentViaTelegram?: boolean }) => {
      setGeneratedLink({ link: data.link, telegramLink: data.telegramLink, reservationId: data.token });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/compensation/basique-reservations"] });
      
      if (data.sentViaTelegram) {
        toast({ title: "✅ Envoyé !", description: "Le lien a été envoyé directement au client via le Bot Telegram." });
      } else {
        toast({ title: "✅ Lien généré", description: "Copiez et partagez le lien avec le client." });
      }
    },
    onError: (err: Error) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });
  
  useEffect(() => {
    if (stats?.settings) {
      setUsageThreshold(stats.settings.usageAlertThreshold);
      setAutoPurchaseEnabled(stats.settings.autoPurchaseEnabled);
      setMinPerCountry(stats.settings.minNumbersPerCountry);
      setMaxUsagesDaily(stats.settings.maxUsagesDaily ?? 20);
      setMaxUsagesWeekly(stats.settings.maxUsagesWeekly ?? 10);
      setMaxUsagesMonthly(stats.settings.maxUsagesMonthly ?? 5);
      setMaintenanceMode(stats.settings.maintenanceMode ?? false);
    }
  }, [stats]);
  
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/settings", {
        usageAlertThreshold: usageThreshold,
        autoPurchaseEnabled,
        minNumbersPerCountry: minPerCountry,
        maxUsagesDaily,
        maxUsagesWeekly,
        maxUsagesMonthly,
        maintenanceMode,
      });
    },
    onSuccess: () => {
      toast({ title: "Paramètres sauvegardés" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: () => {
      toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" });
    },
  });
  
  const runMonitoringMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/run-monitoring");
    },
    onSuccess: () => {
      toast({ title: "Cycle de surveillance exécuté" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/numbers"] });
    },
  });
  
  const purchaseNumberMutation = useMutation({
    mutationFn: async (country: string) => {
      return apiRequest("POST", "/api/admin/purchase-number", { country });
    },
    onSuccess: () => {
      toast({ title: "Nouveau numéro acheté" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/numbers"] });
    },
  });
  
  const syncTwilioMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/sync-twilio");
    },
    onSuccess: (response) => {
      toast({ title: "Synchronisation terminée" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/numbers"] });
    },
    onError: () => {
      toast({ title: "Erreur lors de la synchronisation", variant: "destructive" });
    },
  });
  
  if (!isAuthenticated) {
    return <LoginForm onLogin={() => setIsAuthenticated(true)} />;
  }
  
  if (statsLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }
  
  const getUsageColor = (count: number, threshold: number) => {
    const ratio = count / threshold;
    if (ratio >= 1) return "destructive";
    if (ratio >= 0.8) return "secondary";
    return "default";
  };
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold" data-testid="text-admin-title">Tableau de bord Admin</h1>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => runMonitoringMutation.mutate()}
            disabled={runMonitoringMutation.isPending}
            data-testid="button-run-monitoring"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${runMonitoringMutation.isPending ? 'animate-spin' : ''}`} />
            Vérifier maintenant
          </Button>
          <Button 
            variant="outline"
            onClick={handleLogout}
            data-testid="button-admin-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </div>

      {stats?.settings.franceBundleRequired && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-4" data-testid="alert-france-bundle">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Numéros France — Dossier réglementaire requis (ARCEP)</p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Twilio exige un <strong>bundle de conformité</strong> pour acheter des numéros français. L'achat automatique France est suspendu jusqu'à validation.
            </p>
            <ol className="text-sm text-amber-700 dark:text-amber-400 list-decimal list-inside space-y-0.5 mt-1">
              <li>Allez sur <a href="https://console.twilio.com/us1/regulatory-compliance/bundles" target="_blank" rel="noopener noreferrer" className="underline font-medium">console.twilio.com → Regulatory Compliance → Bundles</a></li>
              <li>Créez un bundle pour <strong>France / NATIONAL / Business</strong></li>
              <li>Soumettez votre pièce d'identité et justificatif de domicile</li>
              <li>Attendez l'approbation Twilio (1-3 jours ouvrés)</li>
              <li>Une fois approuvé, désactivez ce blocage via l'API ou le prochain cycle d'achat</li>
            </ol>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
              Les numéros USA fonctionnent normalement et sont achetés automatiquement.
            </p>
          </div>
        </div>
      )}
      
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard 
          title="Total numéros" 
          value={stats?.totalNumbers ?? 0} 
          icon={Phone}
          description="Tous les numéros dans le système"
        />
        <StatCard 
          title="France" 
          value={stats?.franceNumbers ?? 0} 
          icon={Phone}
          description="Numéros français (+33)"
        />
        <StatCard 
          title="USA" 
          value={stats?.usaNumbers ?? 0} 
          icon={Phone}
          description="Numéros américains (+1)"
        />
        <StatCard 
          title="À la limite" 
          value={stats?.numbersAtLimit ?? 0} 
          icon={AlertTriangle}
          description={`Numéros avec ${stats?.settings.usageAlertThreshold}+ utilisations`}
        />
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Paramètres de surveillance
            </CardTitle>
            <CardDescription>
              Configurez les alertes et l'achat automatique
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="threshold">Seuil d'alerte (utilisations)</Label>
              <Input
                id="threshold"
                type="number"
                value={usageThreshold}
                onChange={(e) => setUsageThreshold(parseInt(e.target.value) || 100)}
                data-testid="input-threshold"
              />
              <p className="text-xs text-muted-foreground">
                Vous recevrez un email quand un numéro atteint ce nombre d'utilisations
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-purchase">Achat automatique</Label>
                <p className="text-xs text-muted-foreground">
                  Acheter de nouveaux numéros automatiquement
                </p>
              </div>
              <Switch
                id="auto-purchase"
                checked={autoPurchaseEnabled}
                onCheckedChange={setAutoPurchaseEnabled}
                data-testid="switch-auto-purchase"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="space-y-0.5">
                <Label htmlFor="maintenance-mode" className="text-destructive font-semibold">
                  Mode maintenance
                </Label>
                <p className="text-xs text-muted-foreground">
                  Affiche la page de maintenance à tous les visiteurs
                </p>
              </div>
              <Switch
                id="maintenance-mode"
                checked={maintenanceMode}
                onCheckedChange={setMaintenanceMode}
                data-testid="switch-maintenance-mode"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="min-numbers">Minimum par pays</Label>
              <Input
                id="min-numbers"
                type="number"
                value={minPerCountry}
                onChange={(e) => setMinPerCountry(parseInt(e.target.value) || 3)}
                data-testid="input-min-numbers"
              />
              <p className="text-xs text-muted-foreground">
                Nombre minimum de numéros disponibles par pays
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Limite d'utilisations par plan</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Nombre max de fois qu'un numéro peut être loué avant d'être retiré
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="max-daily" className="text-xs text-muted-foreground">24h</Label>
                  <Input
                    id="max-daily"
                    type="number"
                    value={maxUsagesDaily}
                    onChange={(e) => setMaxUsagesDaily(parseInt(e.target.value) || 20)}
                    data-testid="input-max-daily"
                    min={1}
                  />
                </div>
                <div>
                  <Label htmlFor="max-weekly" className="text-xs text-muted-foreground">7 jours</Label>
                  <Input
                    id="max-weekly"
                    type="number"
                    value={maxUsagesWeekly}
                    onChange={(e) => setMaxUsagesWeekly(parseInt(e.target.value) || 10)}
                    data-testid="input-max-weekly"
                    min={1}
                  />
                </div>
                <div>
                  <Label htmlFor="max-monthly" className="text-xs text-muted-foreground">30 jours</Label>
                  <Input
                    id="max-monthly"
                    type="number"
                    value={maxUsagesMonthly}
                    onChange={(e) => setMaxUsagesMonthly(parseInt(e.target.value) || 5)}
                    data-testid="input-max-monthly"
                    min={1}
                  />
                </div>
              </div>
            </div>
            
            <Button 
              onClick={() => saveSettingsMutation.mutate()}
              disabled={saveSettingsMutation.isPending}
              className="w-full"
              data-testid="button-save-settings"
            >
              Sauvegarder les paramètres
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              État des services
            </CardTitle>
            <CardDescription>
              Statut de la configuration des services externes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ServiceStatus name="Twilio" configured={stats?.services.twilioConfigured ?? false} />
            <ServiceStatus name="Email" configured={stats?.services.emailConfigured ?? false} />
            <ServiceStatus name="Telegram" configured={telegramStatus?.configured ?? false} />
            
            <div className="pt-4 space-y-2">
              <Label>Achat manuel de numéros</Label>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => purchaseNumberMutation.mutate("france")}
                  disabled={purchaseNumberMutation.isPending || !stats?.services.twilioConfigured}
                  className="flex-1"
                  data-testid="button-purchase-france"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  France
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => purchaseNumberMutation.mutate("usa")}
                  disabled={purchaseNumberMutation.isPending || !stats?.services.twilioConfigured}
                  className="flex-1"
                  data-testid="button-purchase-usa"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  USA
                </Button>
              </div>
              {!stats?.services.twilioConfigured && (
                <p className="text-xs text-muted-foreground">
                  Configurez Twilio pour acheter des numéros
                </p>
              )}
            </div>
            
            {telegramStatus && (
              <div className="pt-2 space-y-2 border-t">
                <Label className="flex items-center gap-2">
                  <Send className="h-3.5 w-3.5" />
                  Surveillance Telegram
                </Label>
                {telegramStatus.configured ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Chat ID : <code className="bg-muted px-1 rounded">{telegramStatus.chatId}</code></p>
                    <p className="text-xs text-muted-foreground">Token : <code className="bg-muted px-1 rounded">{telegramStatus.botToken}</code></p>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Non configuré — ajoutez <code className="bg-muted px-1 rounded">TELEGRAM_BOT_TOKEN</code> et <code className="bg-muted px-1 rounded">TELEGRAM_CHAT_ID</code> dans les secrets.
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testTelegramMutation.mutate()}
                  disabled={testTelegramMutation.isPending || !telegramStatus.configured}
                  className="w-full"
                  data-testid="button-test-telegram"
                >
                  <Send className="mr-2 h-3.5 w-3.5" />
                  {testTelegramMutation.isPending ? "Envoi..." : "Envoyer message de test"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dailyReportMutation.mutate()}
                  disabled={dailyReportMutation.isPending || !telegramStatus.configured}
                  className="w-full"
                  data-testid="button-daily-report"
                >
                  <BarChart2 className="mr-2 h-3.5 w-3.5" />
                  {dailyReportMutation.isPending ? "Génération..." : "Envoyer rapport journalier"}
                </Button>
              </div>
            )}

            <div className="pt-4 space-y-2 border-t">
              <Label>Synchronisation Twilio</Label>
              <p className="text-xs text-muted-foreground">
                Les numéros achetés sur Twilio sont synchronisés automatiquement toutes les 5 minutes
              </p>
              <Button 
                variant="outline"
                onClick={() => syncTwilioMutation.mutate()}
                disabled={syncTwilioMutation.isPending || !stats?.services.twilioConfigured}
                className="w-full"
                data-testid="button-sync-twilio"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncTwilioMutation.isPending ? 'animate-spin' : ''}`} />
                {syncTwilioMutation.isPending ? 'Synchronisation...' : 'Synchroniser maintenant'}
              </Button>
              {stats?.lastSyncAt && (
                <p className="text-xs text-muted-foreground">
                  Dernière sync : {new Date(stats.lastSyncAt).toLocaleString('fr-FR')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <ProfitabilityTable 
        totalNumbers={stats?.totalNumbers ?? 0}
        totalUsage={stats?.totalUsage ?? 0}
        usageThreshold={stats?.settings.usageAlertThreshold ?? 100}
      />
      
      <Card>
        <CardHeader>
          <CardTitle>Tous les numéros</CardTitle>
          <CardDescription>
            Disponibilité par plan et statut Twilio en temps réel
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {numbersLoading ? (
            <div className="space-y-2 p-6">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-numbers">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Numéro</th>
                    <th className="px-4 py-3 text-left font-medium">Pays</th>
                    <th className="px-4 py-3 text-center font-medium">Twilio</th>
                    <th className="px-4 py-3 text-center font-medium">Statut</th>
                    <th className="px-4 py-3 text-center font-medium">
                      <span className="text-blue-600 dark:text-blue-400">24h</span>
                      <span className="text-xs text-muted-foreground ml-1">({stats?.settings.maxUsagesDaily ?? 20})</span>
                    </th>
                    <th className="px-4 py-3 text-center font-medium">
                      <span className="text-purple-600 dark:text-purple-400">7j</span>
                      <span className="text-xs text-muted-foreground ml-1">({stats?.settings.maxUsagesWeekly ?? 10})</span>
                    </th>
                    <th className="px-4 py-3 text-center font-medium">
                      <span className="text-orange-600 dark:text-orange-400">30j</span>
                      <span className="text-xs text-muted-foreground ml-1">({stats?.settings.maxUsagesMonthly ?? 5})</span>
                    </th>
                    <th className="px-4 py-3 text-center font-medium">Utilisations</th>
                    <th className="px-4 py-3 text-left font-medium">Dernière vérif.</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {numbers?.map((num) => (
                    <tr
                      key={num.id}
                      className="border-b hover:bg-muted/30 transition-colors"
                      data-testid={`row-number-${num.id}`}
                    >
                      <td className="px-4 py-3 font-mono font-medium">{num.number}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {num.country === "france" ? "🇫🇷 France" : "🇺🇸 USA"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {num.twilioActive ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium">
                            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse inline-block" />
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-medium">
                            <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                            Inactif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!num.isValid ? (
                          <Badge variant="destructive" className="text-xs">Invalide</Badge>
                        ) : !num.isAvailable ? (
                          <Badge variant="secondary" className="text-xs">Réservé</Badge>
                        ) : (
                          <Badge className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/10">Libre</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {num.availabilityByPlan.daily ? (
                          <span className="text-green-600 dark:text-green-400 font-semibold text-base">✓</span>
                        ) : (
                          <span className="text-red-500 font-semibold text-base">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {num.availabilityByPlan.weekly ? (
                          <span className="text-green-600 dark:text-green-400 font-semibold text-base">✓</span>
                        ) : (
                          <span className="text-red-500 font-semibold text-base">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {num.availabilityByPlan.monthly ? (
                          <span className="text-green-600 dark:text-green-400 font-semibold text-base">✓</span>
                        ) : (
                          <span className="text-red-500 font-semibold text-base">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={getUsageColor(num.usageCount, stats?.settings.usageAlertThreshold ?? 100)} className="text-xs">
                          {num.usageCount}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {num.lastTwilioCheck
                          ? new Date(num.lastTwilioCheck).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                          : "Jamais"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => testSmsMutation.mutate(num.id)}
                          disabled={testSmsMutation.isPending}
                          title="Simuler un SMS reçu"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {numbers?.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                        Aucun numéro dans le système
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Système de compensation Plan Basique */}
      <Card data-testid="card-compensation">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Compensation Plan Basique (2€)
          </CardTitle>
          <CardDescription>
            Gérez les problèmes de réception SMS sur le plan basique. Signalez les numéros défaillants et générez des liens de remplacement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {basiqueData && basiqueData.problematicCount >= 3 && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-destructive">Alerte : {basiqueData.problematicCount} numéros signalés défaillants</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Le seuil de 3 numéros problématiques a été atteint. Considérez d'envoyer des compensations aux clients affectés.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Motif (inclus dans le lien de compensation)</Label>
            <Input
              value={compensationReason}
              onChange={(e) => setCompensationReason(e.target.value)}
              placeholder="Ex: Problème de réception SMS détecté"
              data-testid="input-compensation-reason"
            />
          </div>

          {generatedLink && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-medium text-primary flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Lien Web (Navigateur)
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background border rounded px-2 py-1 truncate">{generatedLink.link}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { navigator.clipboard.writeText(generatedLink.link); toast({ title: "Lien Web copié !" }); }}
                    data-testid="button-copy-link-web"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {generatedLink.telegramLink && (
                <div className="space-y-2 pt-2 border-t border-primary/10">
                  <p className="text-xs font-medium text-primary flex items-center gap-1">
                    <Send className="h-3 w-3" /> Lien Telegram (Auto-envoi)
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background border rounded px-2 py-1 truncate">{generatedLink.telegramLink}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { navigator.clipboard.writeText(generatedLink.telegramLink!); toast({ title: "Lien Telegram copié !" }); }}
                      data-testid="button-copy-link-tg"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    Astuce : Le client n'aura qu'à cliquer sur "Démarrer" dans le bot pour recevoir son lien.
                  </p>
                </div>
              )}
            </div>
          )}

          {basiqueLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !basiqueData?.reservations?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gift className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune réservation active sur le plan basique</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm" data-testid="table-basique-reservations">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Numéro</th>
                    <th className="px-3 py-2 text-left font-medium">Client</th>
                    <th className="px-3 py-2 text-left font-medium">Expire le</th>
                    <th className="px-3 py-2 text-left font-medium">Statut</th>
                    <th className="px-3 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {basiqueData.reservations.map((r) => (
                    <tr key={r.reservationId} className={`transition-colors ${r.isProblematic ? "bg-destructive/5" : "hover:bg-muted/30"}`} data-testid={`row-basique-${r.reservationId}`}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono">{r.phoneNumber}</span>
                          <Badge variant="outline" className="text-xs">{r.country === "france" ? "🇫🇷" : "🇺🇸"}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{r.userEmail ?? "Invité"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(r.expiresAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-3 py-2">
                        {r.isProblematic ? (
                          <Badge variant="destructive" className="text-xs">Défaillant</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Normal</Badge>
                        )}
                        {r.hasActiveCompensation && (
                          <Badge className="text-xs ml-1">Comp. active</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 flex-wrap">
                          {r.phoneNumberId && (
                            <Button
                              size="sm"
                              variant={r.isProblematic ? "default" : "outline"}
                              className={`text-xs h-7 ${r.isProblematic ? "bg-green-600 hover:bg-green-700" : "border-destructive text-destructive hover:bg-destructive/10"}`}
                              onClick={() => markProblematicMutation.mutate({ phoneNumberId: r.phoneNumberId!, isProblematic: !r.isProblematic })}
                              disabled={markProblematicMutation.isPending}
                              data-testid={`button-toggle-problematic-${r.reservationId}`}
                            >
                              {r.isProblematic ? "✓ Résolu" : "Signaler"}
                            </Button>
                          )}
                          {!r.hasActiveCompensation ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7"
                                onClick={() => generateCompensationMutation.mutate({ reservationId: r.reservationId, reason: compensationReason })}
                                disabled={generateCompensationMutation.isPending}
                                data-testid={`button-generate-comp-${r.reservationId}`}
                              >
                                <Gift className="h-3 w-3 mr-1" />
                                Générer lien
                              </Button>
                              {r.telegramChatId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 border-primary text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    generateCompensationMutation.mutate({ 
                                      reservationId: r.reservationId, 
                                      reason: compensationReason,
                                      sendToTelegram: true 
                                    });
                                  }}
                                  disabled={generateCompensationMutation.isPending}
                                  data-testid={`button-send-tg-${r.reservationId}`}
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  Envoyer via Bot
                                </Button>
                              )}
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7"
                              onClick={() => { navigator.clipboard.writeText(r.compensationLink!); toast({ title: "Lien copié !" }); }}
                              data-testid={`button-copy-comp-${r.reservationId}`}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copier lien
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => refetchBasique()} data-testid="button-refresh-basique">
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tableau des comptes utilisateurs */}
      <Card data-testid="card-users">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Comptes utilisateurs
          </CardTitle>
          <CardDescription>
            {usersData?.users?.length ?? 0} compte(s) enregistré(s) sur le site
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm" data-testid="table-users">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Nom complet</th>
                    <th className="px-4 py-3 text-left font-medium">Nom d'utilisateur</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Méthode</th>
                    <th className="px-4 py-3 text-left font-medium">Email vérifié</th>
                    <th className="px-4 py-3 text-left font-medium">Date d'inscription</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {usersData?.users?.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-user-${user.id}`}>
                      <td className="px-4 py-3 font-medium">
                        {user.first_name || user.last_name
                          ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
                          : <span className="text-muted-foreground italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {user.username ?? <span className="italic">—</span>}
                      </td>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {user.auth_provider === "google" ? "Google" : "Email"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {user.email_verified ? (
                          <span className="text-green-600 dark:text-green-400 font-semibold">✓</span>
                        ) : (
                          <span className="text-red-500 font-semibold">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(user.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                    </tr>
                  ))}
                  {(!usersData?.users || usersData.users.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Aucun compte enregistré
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mon accès admin */}
      <AdminMyAccessCard numbers={numbers ?? []} />

      {/* Avis clients */}
      <AdminReviewsCard />
    </div>
  );
}

interface AdminReservation {
  id: string;
  planId: string;
  startsAt: string;
  expiresAt: string;
  phoneNumberId: string;
  number: string | null;
  country: string | null;
  telegramConnected: boolean;
  telegramLink: string | null;
}

function AdminMyAccessCard({ numbers }: { numbers: AdminNumber[] }) {
  const { toast } = useToast();
  const [selectedCountry, setSelectedCountry] = useState<"france" | "usa">("france");
  const [selectedNumberId, setSelectedNumberId] = useState<string>("");
  const [selectedPlan, setSelectedPlan] = useState<"daily" | "weekly" | "monthly">("monthly");

  const { data: myReservations = [], isLoading: reservationsLoading, refetch: refetchReservations } = useQuery<AdminReservation[]>({
    queryKey: ["/api/admin/my-reservations"],
    refetchInterval: 30000,
  });

  const availableNumbers = numbers.filter(
    n => n.isAvailable && n.isValid && n.country === selectedCountry
  );

  const reserveMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/reserve-number", {
        phoneNumberId: selectedNumberId,
        planId: selectedPlan,
      }),
    onSuccess: () => {
      toast({ title: "✅ Numéro réservé", description: "Votre réservation admin est active." });
      setSelectedNumberId("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/my-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/numbers"] });
    },
    onError: (err: Error) =>
      toast({ title: "❌ Erreur", description: err.message, variant: "destructive" }),
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/reservations/${id}/release`),
    onSuccess: () => {
      toast({ title: "Numéro libéré" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/my-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/numbers"] });
    },
    onError: (err: Error) =>
      toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const getTelegramLinkMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("GET", `/api/admin/reservations/${id}/telegram-link`);
      return res.json() as Promise<{ deepLink: string; connected: boolean; sentToTelegram: boolean }>;
    },
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.deepLink);
      if (data.connected) {
        toast({ title: "✅ Déjà connecté", description: "Ce numéro est déjà lié à Telegram." });
      } else if (data.sentToTelegram) {
        toast({
          title: "📨 Lien envoyé sur Telegram",
          description: "Ouvrez Telegram et cliquez sur le lien pour activer la réception des SMS.",
        });
      } else {
        toast({
          title: "🔗 Lien copié",
          description: "Telegram non configuré côté serveur — le lien a été copié dans le presse-papiers.",
        });
      }
      refetchReservations();
    },
    onError: (err: Error) =>
      toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const planLabels: Record<string, string> = {
    daily: "24 heures",
    weekly: "7 jours",
    monthly: "30 jours",
  };

  return (
    <Card data-testid="card-admin-access">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Mon accès admin
        </CardTitle>
        <CardDescription>
          Réservez un numéro gratuitement pour votre propre usage, sans passer par Stripe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Mes réservations actives */}
        {myReservations.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Réservations actives</p>
            {myReservations.map(r => (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg bg-primary/5"
                data-testid={`card-admin-reservation-${r.id}`}
              >
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{r.number}</span>
                    <Badge variant="outline" className="text-xs">
                      {r.country === "france" ? "🇫🇷 France" : "🇺🇸 USA"}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">{planLabels[r.planId] ?? r.planId}</Badge>
                    <Badge variant="default" className="text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">Admin</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Expire le {new Date(r.expiresAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                  {r.telegramConnected && (
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">✅ Telegram connecté</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => getTelegramLinkMutation.mutate(r.id)}
                    disabled={getTelegramLinkMutation.isPending}
                    data-testid={`button-telegram-link-${r.id}`}
                    title="Obtenir le lien Telegram pour recevoir les SMS"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {r.telegramConnected ? "Lien Telegram" : "Connecter Telegram"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => releaseMutation.mutate(r.id)}
                    disabled={releaseMutation.isPending}
                    data-testid={`button-release-${r.id}`}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Libérer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {reservationsLoading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {/* Formulaire de réservation */}
        <div className="space-y-4 border-t pt-4">
          <p className="text-sm font-medium">Réserver un numéro</p>

          <div className="flex gap-2">
            <Button
              variant={selectedCountry === "france" ? "default" : "outline"}
              size="sm"
              onClick={() => { setSelectedCountry("france"); setSelectedNumberId(""); }}
              data-testid="button-country-france"
            >
              🇫🇷 France
            </Button>
            <Button
              variant={selectedCountry === "usa" ? "default" : "outline"}
              size="sm"
              onClick={() => { setSelectedCountry("usa"); setSelectedNumberId(""); }}
              data-testid="button-country-usa"
            >
              🇺🇸 USA
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Numéro disponible</Label>
            {availableNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Aucun numéro disponible pour {selectedCountry === "france" ? "la France" : "les USA"} en ce moment.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableNumbers.map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedNumberId(n.id)}
                    className={`flex items-center gap-2 p-2 border rounded-lg text-sm text-left transition-colors ${
                      selectedNumberId === n.id
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted/50"
                    }`}
                    data-testid={`button-select-number-${n.id}`}
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono">{n.number}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Durée</Label>
            <div className="flex gap-2">
              {(["daily", "weekly", "monthly"] as const).map(plan => (
                <Button
                  key={plan}
                  variant={selectedPlan === plan ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPlan(plan)}
                  data-testid={`button-plan-${plan}`}
                >
                  {planLabels[plan]}
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => reserveMutation.mutate()}
            disabled={!selectedNumberId || reserveMutation.isPending}
            className="w-full"
            data-testid="button-admin-reserve"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            {reserveMutation.isPending ? "Réservation en cours..." : "Réserver gratuitement"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminReviewsCard() {
  const { toast } = useToast();
  const { data: reviewsList = [], isLoading } = useQuery<Review[]>({
    queryKey: ["/api/reviews"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/reviews/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      toast({ title: "Avis supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer l'avis.", variant: "destructive" });
    },
  });

  return (
    <Card data-testid="card-reviews">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          Avis clients
        </CardTitle>
        <CardDescription>
          {reviewsList.length} avis publié(s) — supprimez les commentaires inappropriés
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : reviewsList.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Aucun avis pour l'instant.</p>
        ) : (
          <div className="space-y-3">
            {reviewsList.map((review) => (
              <div key={review.id} className="flex items-start justify-between gap-4 p-3 border rounded-lg" data-testid={`row-review-${review.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{review.name}</span>
                    <span className="text-yellow-400">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{review.comment}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => deleteMutation.mutate(review.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-review-${review.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
