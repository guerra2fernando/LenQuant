import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  className,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "group relative p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm",
        "transition-all duration-300 hover:border-purple-500/30 hover:bg-card/80",
        "glow-card",
        className
      )}
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
        <Icon className="w-6 h-6 text-purple-400" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-display font-semibold text-foreground mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
