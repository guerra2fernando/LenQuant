interface StepCardProps {
  number: number;
  title: string;
  description: string;
  isLast?: boolean;
}

export function StepCard({ number, title, description, isLast }: StepCardProps) {
  return (
    <div className="relative flex flex-col items-center text-center">
      {/* Step Number */}
      <div className="w-16 h-16 rounded-full bg-purple-500/20 border-2 border-purple-500/50 flex items-center justify-center mb-6 relative z-10">
        <span className="text-2xl font-bold text-purple-400">{number}</span>
      </div>

      {/* Connector Line (hidden on last item) */}
      {!isLast && (
        <div className="hidden lg:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-0.5 bg-gradient-to-r from-purple-500/50 to-transparent" />
      )}

      {/* Content */}
      <h3 className="text-xl font-display font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {description}
      </p>
    </div>
  );
}
