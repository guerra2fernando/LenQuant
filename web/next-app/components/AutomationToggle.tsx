import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type AutomationToggleProps = {
  enabled: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  className?: string;
};

export function AutomationToggle({
  enabled,
  onChange,
  disabled,
  label = "Automation",
  description = "Enable or disable autonomous evolution engine.",
  className,
}: AutomationToggleProps) {
  return (
    <div className={cn("flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-4", className)}>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={enabled} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </div>
  );
}

