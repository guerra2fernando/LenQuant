import { Badge } from "@/components/ui/badge";

type SchedulerState = {
  scheduler_id?: string;
  enabled?: boolean;
  cron?: string;
  updated_at?: string;
  next_run?: string | null;
};

type SchedulerStatusBadgeProps = {
  state?: SchedulerState;
};

export function SchedulerStatusBadge({ state }: SchedulerStatusBadgeProps) {
  const enabled = state?.enabled ?? false;
  const variant = enabled ? "default" : "secondary";
  const label = enabled ? "Scheduler Active" : "Scheduler Paused";
  const cron = state?.cron ? ` • ${state.cron}` : "";
  return <Badge variant={variant}>{`${label}${cron}`}</Badge>;
}

