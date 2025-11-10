/* eslint-disable */
// @ts-nocheck
import { EvidenceAttachmentList } from "@/components/EvidenceAttachmentList";

type AssistantHistoryEntry = {
  answer_id: string;
  assistant_payload: {
    summary: string;
  };
  retrieved_evidence?: any[];
};

type EvidenceDrawerProps = {
  entry: AssistantHistoryEntry | null;
  onClose: () => void;
};

export function EvidenceDrawer({ entry, onClose }: EvidenceDrawerProps) {
  if (!entry) {
    return null;
  }

  const evidence = entry.retrieved_evidence ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-md">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-background p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Evidence for {entry.answer_id}</h2>
            <p className="text-sm text-muted-foreground">{entry.assistant_payload?.summary}</p>
          </div>
          <button
            type="button"
            className="text-sm font-medium text-primary underline"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-6">
          <EvidenceAttachmentList evidence={evidence} />
        </div>
      </div>
    </div>
  );
}

