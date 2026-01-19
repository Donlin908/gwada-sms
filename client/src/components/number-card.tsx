import { useState } from "react";
import { Link } from "wouter";
import { Check, Copy, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type PhoneNumberResponse } from "@shared/schema";
import { FranceFlag, UsaFlag } from "./flag-icons";

interface NumberCardProps {
  phoneNumber: PhoneNumberResponse;
  planId?: string;
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

  return (
    <Card className="overflow-hidden hover-elevate" data-testid={`card-number-${phoneNumber.id}`}>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <CountryFlag className="h-6 w-6" />
            <span className="text-sm text-muted-foreground" data-testid={`text-country-${phoneNumber.id}`}>{countryName}</span>
          </div>
          <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400" data-testid={`badge-available-${phoneNumber.id}`}>
            Disponible
          </Badge>
        </div>

        <div className="mb-4 font-mono text-2xl font-semibold tracking-wide" data-testid={`text-number-${phoneNumber.id}`}>
          {phoneNumber.number}
        </div>

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
            <Button size="sm" className="w-full gap-2" data-testid={`button-reserve-${phoneNumber.id}`}>
              <CreditCard className="h-4 w-4" />
              Réserver
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
