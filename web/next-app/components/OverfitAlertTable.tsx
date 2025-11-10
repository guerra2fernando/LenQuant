import { AcknowledgeDialog } from "@/components/AcknowledgeDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type OverfitAlert = {
  _id?: string;
  strategy_id: string;
  decay: number;
  baseline_roi?: number;
  recent_roi?: number;
  detected_at?: string;
  status?: string;
  latest_run_id?: string | null;
  sharpe_delta?: number;
};

type Props = {
  alerts?: OverfitAlert[];
  isLoading?: boolean;
  onAcknowledge?: (alertId: string) => void;
  acknowledgingId?: string | null;
};

export function OverfitAlertTable({ alerts, isLoading = false, onAcknowledge, acknowledgingId }: Props) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Checking strategies for overfitting...</p>;
  }

  if (!alerts || alerts.length === 0) {
    return <p className="text-sm text-muted-foreground">No overfitting alerts 🎉</p>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Strategy</TableHead>
            <TableHead className="text-right">Decay</TableHead>
            <TableHead className="text-right">Baseline ROI</TableHead>
            <TableHead className="text-right">Recent ROI</TableHead>
            <TableHead className="text-right">Sharpe Δ</TableHead>
            <TableHead>Detected</TableHead>
            {onAcknowledge && <TableHead className="w-[120px] text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={alert._id ?? alert.strategy_id}>
              <TableCell className="font-medium">{alert.strategy_id}</TableCell>
              <TableCell className="text-right text-destructive">{(alert.decay * 100).toFixed(1)}%</TableCell>
              <TableCell className="text-right">{((alert.baseline_roi ?? 0) * 100).toFixed(2)}%</TableCell>
              <TableCell className="text-right">{((alert.recent_roi ?? 0) * 100).toFixed(2)}%</TableCell>
              <TableCell className="text-right">{(alert.sharpe_delta ?? 0).toFixed(3)}</TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">
                  {alert.detected_at ? new Date(alert.detected_at).toLocaleString() : "—"}
                </span>
              </TableCell>
              {onAcknowledge && alert._id && (
                <TableCell className="text-right">
                  <AcknowledgeDialog
                    alertId={alert._id}
                    onConfirm={async (id) => onAcknowledge(id)}
                    disabled={acknowledgingId === alert._id}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

