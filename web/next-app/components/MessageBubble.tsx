/* eslint-disable */
// @ts-nocheck
type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  evidenceCount?: number;
  onShowEvidence?: () => void;
};

export function MessageBubble({ role, content, timestamp, evidenceCount, onShowEvidence }: MessageBubbleProps) {
  const isAssistant = role === "assistant";

  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-3xl rounded-lg border p-4 shadow-sm ${
          isAssistant
            ? "border-primary/30 bg-primary/5 text-foreground"
            : "border-muted bg-muted text-foreground"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{isAssistant ? "Assistant" : "You"}</span>
          {timestamp && <span className="text-xs text-muted-foreground">{new Date(timestamp).toLocaleTimeString()}</span>}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        {typeof evidenceCount === "number" && evidenceCount > 0 && (
          <button
            type="button"
            className="mt-3 text-xs font-medium text-primary underline"
            onClick={onShowEvidence}
          >
            View evidence ({evidenceCount})
          </button>
        )}
      </div>
    </div>
  );
}

