import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type InsightCardProps = {
  title: string;
  bullets?: string[];
  summary?: string;
};

export function InsightCard({ title, bullets = [], summary }: InsightCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {summary ? <p>{summary}</p> : null}
        {bullets.length ? (
          <ul className="list-disc space-y-1 pl-4">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

