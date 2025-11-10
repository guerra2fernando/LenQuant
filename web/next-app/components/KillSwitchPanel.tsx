/* eslint-disable */
// @ts-nocheck
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type KillSwitchPanelProps = {
  killSwitch: { armed: boolean; reason?: string | null; actor?: string | null } | null;
  onArm: (reason: string) => Promise<void>;
  onRelease: () => Promise<void>;
};

export function KillSwitchPanel({ killSwitch, onArm, onRelease }: KillSwitchPanelProps) {
  const [reason, setReason] = useState("");
  const armed = killSwitch?.armed ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Kill Switch</CardTitle>
        <CardDescription>
          Cancel open orders and freeze execution instantly. Provide a reason for audit purposes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/40 p-3 text-sm">
          <div>
            <div className="font-medium">{armed ? "Armed" : "Disarmed"}</div>
            <div className="text-xs text-muted-foreground">
              {killSwitch?.reason ? `Last action: ${killSwitch.reason}` : "No active kill switch."}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${armed ? "bg-red-500" : "bg-emerald-500"}`} />
          </div>
        </div>
        <Input
          placeholder="Reason for arming the kill switch"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={armed}
        />
        <div className="flex gap-2">
          <Button
            variant="destructive"
            className="flex-1"
            disabled={armed || !reason.trim()}
            onClick={async () => {
              if (!reason.trim()) {
                return;
              }
              await onArm(reason.trim());
              setReason("");
            }}
          >
            Arm Kill Switch
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={!armed}
            onClick={async () => {
              await onRelease();
            }}
          >
            Release
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

