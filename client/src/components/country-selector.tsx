import { type Country } from "@shared/schema";
import { FranceFlag, UsaFlag } from "./flag-icons";

interface CountrySelectorProps {
  selected: Country;
  onChange: (country: Country) => void;
}

export function CountrySelector({ selected, onChange }: CountrySelectorProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onChange("france")}
        className={`flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors ${
          selected === "france"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover-elevate"
        }`}
        data-testid="button-select-france"
      >
        <FranceFlag className="h-5 w-5" />
        France
      </button>
      <button
        onClick={() => onChange("usa")}
        className={`flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors ${
          selected === "usa"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover-elevate"
        }`}
        data-testid="button-select-usa"
      >
        <UsaFlag className="h-5 w-5" />
        États-Unis
      </button>
    </div>
  );
}
