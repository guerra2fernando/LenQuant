import { Star } from "lucide-react";

interface TestimonialCardProps {
  quote: string;
  author: string;
  role?: string;
  rating?: number;
}

export function TestimonialCard({
  quote,
  author,
  role,
  rating = 5,
}: TestimonialCardProps) {
  return (
    <div className="p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm">
      {/* Rating Stars */}
      <div className="flex gap-1 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < rating ? "text-yellow-400 fill-yellow-400" : "text-muted"
            }`}
          />
        ))}
      </div>

      {/* Quote */}
      <blockquote className="text-foreground leading-relaxed mb-4">
        "{quote}"
      </blockquote>

      {/* Author */}
      <div className="flex items-center gap-3">
        {/* Avatar placeholder */}
        <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
          <span className="text-sm font-medium text-purple-400">
            {author.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{author}</div>
          {role && (
            <div className="text-xs text-muted-foreground">{role}</div>
          )}
        </div>
      </div>
    </div>
  );
}
