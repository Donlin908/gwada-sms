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
  BarChart3
} from "lucide-react";

interface AdminStats {
  totalNumbers: number;
  franceNumbers: number;
  usaNumbers: number;
  numbersAtLimit: number;
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

export default function AdminPage() {
  const { toast } = useToast();
  
  const [usageThreshold, setUsageThreshold] = useState(100);
  const [autoPurchaseEnabled, setAutoPurchaseEnabled] = useState(false);
  const [minPerCountry, setMinPerCountry] = useState(3);
  
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30000,
  });
  
  const { data: numbers, isLoading: numbersLoading } = useQuery<AdminNumber[]>({
    queryKey: ["/api/admin/numbers"],
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="text-admin-title">Tableau de bord Admin</h1>
        <Button 
          onClick={() => runMonitoringMutation.mutate()}
          disabled={runMonitoringMutation.isPending}
          data-testid="button-run-monitoring"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${runMonitoringMutation.isPending ? 'animate-spin' : ''}`} />
          Vérifier maintenant
        </Button>
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
