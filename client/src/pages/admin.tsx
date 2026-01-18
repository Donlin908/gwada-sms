import { useQuery, useMutation } from "@tanstack/react-query";
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
  Lock,
  LogOut,
  TrendingUp,
  DollarSign,
  Users
} from "lucide-react";

interface AdminStats {
  totalNumbers: number;
  franceNumbers: number;
  usaNumbers: number;
  numbersAtLimit: number;
  totalUsage: number;
  alertsSent: number;
  numbersPurchased: number;
  settings: {
    usageAlertThreshold: number;
    autoPurchaseEnabled: boolean;
    minNumbersPerCountry: number;
  };
  services: {
    emailConfigured: boolean;
    twilioConfigured: boolean;
  };
}

interface AdminNumber {
  id: string;
  number: string;
  country: string;
  usageCount: number;
  isAvailable: boolean;
  isValid: boolean;
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
  
  useEffect(() => {
    if (stats?.settings) {
      setUsageThreshold(stats.settings.usageAlertThreshold);
      setAutoPurchaseEnabled(stats.settings.autoPurchaseEnabled);
      setMinPerCountry(stats.settings.minNumbersPerCountry);
    }
  }, [stats]);
  
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/settings", {
        usageAlertThreshold: usageThreshold,
        autoPurchaseEnabled,
        minNumbersPerCountry: minPerCountry,
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
    onError: () => {
      toast({ title: "Erreur lors de l'achat", variant: "destructive" });
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
            Liste complète avec statistiques d'utilisation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {numbersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {numbers?.map((num) => (
                <div 
                  key={num.id} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                  data-testid={`row-number-${num.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="font-mono font-medium">{num.number}</div>
                    <Badge variant="outline">
                      {num.country === "france" ? "France" : "USA"}
                    </Badge>
                    {!num.isValid && (
                      <Badge variant="destructive">Invalide</Badge>
                    )}
                    {!num.isAvailable && (
                      <Badge variant="secondary">Réservé</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                      {new Date(num.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                    <Badge variant={getUsageColor(num.usageCount, stats?.settings.usageAlertThreshold ?? 100)}>
                      {num.usageCount} utilisations
                    </Badge>
                  </div>
                </div>
              ))}
              {numbers?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun numéro dans le système
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
