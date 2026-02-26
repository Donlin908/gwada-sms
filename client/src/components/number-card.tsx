import { useState } from "react";
import { Link } from "wouter";
import { Check, Copy, CreditCard, Wifi, WifiOff, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type PhoneNumberResponse } from "@shared/schema";
import { FranceFlag, UsaFlag } from "./flag-icons";

interface NumberCardProps {
  phoneNumber: PhoneNumberResponse;
  planId?: string;
}

function PlanBadge({ label, available, usageCount, maxUsage }: { label: string; available: boolean; usageCount: number; maxUsage: number }) {
  return (
    <div
      className={`flex flex-col items-center rounded-md px-2 py-1.5 text-xs border ${
        available
          ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
          : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
      }`}
      title={`${usageCount}/${maxUsage} utilisations`}
    >
      <span className="font-semibold">{label}</span>
      <span className="opacity-70">{usageCount}/{maxUsage}</span>
    </div>
  );
}

export function NumberCard({ phoneNumber, planId }: NumberCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(phoneNumber.number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const CountryFlag = phoneNumber.country === "france" ? FranceFlag : UsaFlag;
  const countryName = phoneNumber.country === "france" ? "France" : "États-Unis";

  const isFullyUnavailable = !phoneNumber.availabilityByPlan?.daily &&
    !phoneNumber.availabilityByPlan?.weekly &&
    !phoneNumber.availabilityByPlan?.monthly;

  const twilioActive = phoneNumber.twilioActive ?? phoneNumber.isValid;
  const lastChecked = phoneNumber.lastTwilioCheck
    ? new Date(phoneNumber.lastTwilioCheck).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const usageCount = phoneNumber.usageCount ?? 0;
  const maxUsageDaily = phoneNumber.maxUsageDaily ?? 20;
  const maxUsageWeekly = phoneNumber.maxUsageWeekly ?? 10;
  const maxUsageMonthly = phoneNumber.maxUsageMonthly ?? 5;
  const availabilityByPlan = phoneNumber.availabilityByPlan ?? {
    daily: phoneNumber.isAvailable,
    weekly: phoneNumber.isAvailable,
    monthly: phoneNumber.isAvailable,
  };

  return (
    <Card
      className={`overflow-hidden hover-elevate ${isFullyUnavailable ? "opacity-60" : ""}`}
      data-testid={`card-number-${phoneNumber.id}`}
    >
      <CardContent className="p-6">
        <div className="mb-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <CountryFlag className="h-6 w-6" />
            <span className="text-sm text-muted-foreground" data-testid={`text-country-${phoneNumber.id}`}>{countryName}</span>
          </div>
          <div className="flex items-center gap-2">
            {twilioActive ? (
              <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400" title={lastChecked ? `Vérifié à ${lastChecked}` : "Actif"}>
                <Wifi className="h-3 w-3" />
                <span data-testid={`badge-twilio-${phoneNumber.id}`}>Actif</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <WifiOff className="h-3 w-3" />
                <span data-testid={`badge-twilio-${phoneNumber.id}`}>Inactif</span>
              </div>
            )}
            {!isFullyUnavailable ? (
              <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400" data-testid={`badge-available-${phoneNumber.id}`}>
                Disponible
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400" data-testid={`badge-available-${phoneNumber.id}`}>
                Indisponible
              </Badge>
            )}
          </div>
        </div>

        <div className="mb-3 font-mono text-2xl font-semibold tracking-wide" data-testid={`text-number-${phoneNumber.id}`}>
          {phoneNumber.number}
        </div>

        {/* Per-plan availability */}
        <div className="mb-4 grid grid-cols-3 gap-1.5" data-testid={`plan-availability-${phoneNumber.id}`}>
          <PlanBadge label="24h" available={availabilityByPlan.daily} usageCount={usageCount} maxUsage={maxUsageDaily} />
          <PlanBadge label="7j" available={availabilityByPlan.weekly} usageCount={usageCount} maxUsage={maxUsageWeekly} />
          <PlanBadge label="30j" available={availabilityByPlan.monthly} usageCount={usageCount} maxUsage={maxUsageMonthly} />
        </div>

        {lastChecked && (
          <div className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Vérifié à {lastChecked}</span>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="flex-1 gap-2"
            data-testid={`button-copy-${phoneNumber.id}`}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copié
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copier
              </>
            )}
          </Button>
          <Link href={`/payment/${phoneNumber.id}${planId ? `?plan=${planId}` : ''}`} className="flex-1">
            <Button
              size="sm"
              className="w-full gap-2"
              disabled={isFullyUnavailable}
              data-testid={`button-reserve-${phoneNumber.id}`}
            >
              <CreditCard className="h-4 w-4" />
              {isFullyUnavailable ? "Épuisé" : "Réserver"}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
