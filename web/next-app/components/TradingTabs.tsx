/* eslint-disable */
// @ts-nocheck
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TradingTabsProps = {
  mode: string;
  onModeChange: (mode: string) => void;
  modes?: { key: string; label: string; description?: string }[];
  className?: string;
};

const DEFAULT_MODES = [
  { key: "paper", label: "Paper", description: "Safe simulation using virtual balances." },
  { key: "testnet", label: "Testnet", description: "Exchange sandbox for end-to-end rehearsals." },
  { key: "live", label: "Live", description: "Guarded production execution with limits." },
];

export function TradingTabs({ mode, onModeChange, modes = DEFAULT_MODES, className }: TradingTabsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {modes.map((item) => {
        const active = item.key === mode;
        return (
          <div key={item.key} className="flex flex-col gap-1">
            <Button
              variant={active ? "default" : "outline"}
              className={cn("min-w-[110px] justify-start", active && "shadow-md")}
              onClick={() => onModeChange(item.key)}
            >
              {item.label}
            </Button>
            {item.description ? (
              <p className={cn("text-xs text-muted-foreground", !active && "opacity-60")}>{item.description}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

