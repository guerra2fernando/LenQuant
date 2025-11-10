/* eslint-disable */
// @ts-nocheck
type PromptTemplatePreviewProps = {
  query: string;
  symbol?: string;
  date?: string;
  horizon?: string;
  strategyId?: string;
};

export function PromptTemplatePreview({ query, symbol, date, horizon, strategyId }: PromptTemplatePreviewProps) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background/50 p-3 text-xs text-muted-foreground">
      <div className="font-semibold text-foreground/80">Grounding prompt preview</div>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">
        {`CONTEXT:
- QUERY: ${query || "<your question>"}
- SYMBOL: ${symbol || "n/a"}
- DATE: ${date || "latest"}
- HORIZON: ${horizon || "n/a"}
- STRATEGY: ${strategyId || "n/a"}
- FACTS: [retrieved evidence]

INSTRUCTIONS:
- Summarize succinctly (max 200 words).
- Provide evidence-backed causes and actionable next steps.
- Include evidence_refs for each cited fact.`}
      </pre>
    </div>
  );
}

