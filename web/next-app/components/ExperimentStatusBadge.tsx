import { Badge } from "@/components/ui/badge";

type Props = {
  status?: string;
};

const STATUS_TO_VARIANT: Record<string, "success" | "secondary" | "warning" | "destructive" | "outline"> = {
  ready: "secondary",
  running: "warning",
  completed: "success",
  failed: "destructive",
  pending: "secondary",
};

export function ExperimentStatusBadge({ status }: Props) {
  if (!status) {
    return <Badge variant="outline">unknown</Badge>;
  }
  const normalized = status.toLowerCase();
  const variant = STATUS_TO_VARIANT[normalized] ?? "outline";
  return <Badge variant={variant}>{normalized}</Badge>;
}


