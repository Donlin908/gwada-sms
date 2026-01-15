import { MessageSquareOff, Phone } from "lucide-react";

interface EmptyStateProps {
  type: "numbers" | "messages";
  title?: string;
  description?: string;
}

export function EmptyState({ type, title, description }: EmptyStateProps) {
  const icons = {
    numbers: Phone,
    messages: MessageSquareOff,
  };

  const defaults = {
    numbers: {
      title: "Aucun numéro disponible",
      description: "Revenez dans quelques instants, de nouveaux numéros seront bientôt disponibles.",
    },
    messages: {
      title: "En attente de messages...",
      description: "Les SMS apparaîtront ici dès leur réception. Actualisez la page pour voir les nouveaux messages.",
    },
  };

  const Icon = icons[type];
  const displayTitle = title || defaults[type].title;
  const displayDescription = description || defaults[type].description;

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center" data-testid={`empty-state-${type}`}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="max-w-sm">
        <h3 className="mb-2 font-semibold">{displayTitle}</h3>
        <p className="text-sm text-muted-foreground">{displayDescription}</p>
      </div>
    </div>
  );
}
