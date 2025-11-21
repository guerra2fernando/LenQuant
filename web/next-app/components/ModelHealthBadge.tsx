/* eslint-disable */
// @ts-nocheck
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";

type ModelHealth = "fresh" | "aging" | "stale";

type Props = {
  trainedAt?: string;
  showIcon?: boolean;
  showTooltip?: boolean;
};

export function ModelHealthBadge({ trainedAt, showIcon = true, showTooltip = true }: Props) {
  if (!trainedAt) {
    return (
      <Badge variant="outline" className="border-gray-400 text-gray-600">
        {showIcon && <AlertCircle className="mr-1 h-3 w-3" />}
        Unknown
      </Badge>
    );
  }

  const trained = new Date(trainedAt);
  const now = new Date();
  const ageInHours = (now.getTime() - trained.getTime()) / (1000 * 60 * 60);
  const ageInDays = Math.floor(ageInHours / 24);

  let health: ModelHealth;
  let variant: "default" | "secondary" | "destructive" | "outline";
  let icon: React.ReactNode;
  let label: string;
  let tooltipText: string;

  if (ageInHours < 48) {
    health = "fresh";
    variant = "default";
    icon = <CheckCircle className="mr-1 h-3 w-3" />;
    label = "Fresh";
    tooltipText = `Model trained ${ageInDays === 0 ? "today" : `${ageInDays} day${ageInDays > 1 ? "s" : ""} ago`}. Using latest data.`;
  } else if (ageInHours < 168) {
    // 7 days
    health = "aging";
    variant = "secondary";
    icon = <Clock className="mr-1 h-3 w-3" />;
    label = "Aging";
    tooltipText = `Model trained ${ageInDays} days ago. Consider retraining soon.`;
  } else {
    health = "stale";
    variant = "destructive";
    icon = <AlertCircle className="mr-1 h-3 w-3" />;
    label = "Stale";
    tooltipText = `Model trained ${ageInDays} days ago. Retrain recommended.`;
  }

  const badge = (
    <Badge variant={variant} className={health === "fresh" ? "bg-green-500 hover:bg-green-600" : ""}>
      {showIcon && icon}
      {label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

