/* eslint-disable */
// @ts-nocheck
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { AssistantToolbar } from "@/components/AssistantToolbar";
import { ChatTranscript } from "@/components/ChatTranscript";
import { ContextPanel } from "@/components/ContextPanel";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { EvidenceDrawer } from "@/components/EvidenceDrawer";
import { PromptTemplatePreview } from "@/components/PromptTemplatePreview";
import { ProactiveSuggestions } from "@/components/ProactiveSuggestions";
import { QuickActions } from "@/components/QuickActions";
import { RecommendationCard } from "@/components/RecommendationCard";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { useNotificationCenter } from "@/components/NotificationCenter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useMode } from "@/lib/mode-context";
import { fetcher, postJson } from "@/lib/api";

export default function AssistantWorkspacePage() {
  const router = useRouter();
  const { isEasyMode } = useMode();
  const initialPrompt = typeof router.query.prompt === "string" ? router.query.prompt : "";
  const [query, setQuery] = useState(initialPrompt);
  const [symbol, setSymbol] = useState("BTC/USD");
  const [date, setDate] = useState("");
  const [horizon, setHorizon] = useState("1h");
  const [strategyId, setStrategyId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [error, setError] = useState<string | null>(null);
  const [isLaunchingCohort, setIsLaunchingCohort] = useState(false);

  const { addNotification } = useNotificationCenter();

  const {
    data: historyData,
    error: historyError,
    mutate: refreshHistory,
    isValidating: historyLoading,
  } = useSWR("/api/assistant/history?limit=20", fetcher, { refreshInterval: 60000 });

  const {
    data: recommendationsData,
    error: recommendationsError,
    mutate: refreshRecommendations,
  } = useSWR("/api/assistant/recommendations?limit=6", fetcher, { refreshInterval: 45000 });

  useEffect(() => {
    if (initialPrompt) {
      setQuery(initialPrompt);
    }
  }, [initialPrompt]);

  const history = historyData?.history ?? [];
  const recommendations = useMemo(
    () => recommendationsData?.recommendations ?? [],
    [recommendationsData],
  );

  const handleSubmit = async () => {
    if (!query.trim()) {
      return;
    }
    setIsLoading(true);
    try {
      const payload = {
        query,
        context: {
          symbol: symbol || undefined,
          date: date || undefined,
          horizon: horizon || undefined,
          strategy_id: strategyId || undefined,
        },
        include_recommendations: true,
      };
      const response = await postJson("/api/assistant/query", payload);
      toast.success("Assistant responded", {
        description: response?.payload?.summary ?? "Response recorded.",
      });
      addNotification({
        title: "Assistant response logged",
        message: `Answer ${response?.answer_id ?? ""} ready with ${response?.payload?.evidence_refs?.length ?? 0} evidence references.`,
        kind: "success",
      });
      await Promise.all([refreshHistory(), refreshRecommendations()]);
      setQuery("");
      setError(null);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Unable to contact assistant.";
      setError(errorMessage);
      toast.error("Assistant request failed", {
        description: errorMessage,
      });
      addNotification({
        title: "Assistant request failed",
        message: errorMessage,
        kind: "warning",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecision = async (rec_id, decision, extra) => {
    try {
      await postJson(`/api/assistant/recommendations/${rec_id}/decision`, {
        decision,
        user_notes: extra?.user_notes,
        modified_params: extra?.modified_params,
        user_id: "operator",
      });
      if (decision === "approve") {
        toast.success(`Recommendation ${decision}`, {
          description: `Recorded decision for ${rec_id}`,
        });
      } else {
        toast(`Recommendation ${decision}`, {
          description: `Recorded decision for ${rec_id}`,
        });
      }
      addNotification({
        title: `Recommendation ${decision}`,
        message: `${rec_id} marked as ${decision}.`,
        kind: decision === "approve" ? "success" : "info",
      });
      await refreshRecommendations();
    } catch (error) {
      console.error(error);
      toast.error("Decision failed", {
        description: error?.message ?? "Unable to update recommendation.",
      });
    }
  };

  const handleLaunchIntraday = async ({ bankroll }: { bankroll: number }) => {
    setIsLaunchingCohort(true);
    try {
      const response = await postJson("/api/experiments/cohorts/launch", {
        bankroll,
        agent_count: 30,
        allocation_policy: "equal",
        leverage_ceiling: 5,
      });
      const launchedId = response?.cohort?.cohort_id ?? "cohort";
      toast.success("Intraday cohort launched", {
        description: `30 agents allocated across $${bankroll.toLocaleString()} (${launchedId}).`,
      });
      addNotification({
        title: "Intraday cohort launched",
        message: `Assistant launched cohort ${launchedId} with $${bankroll.toLocaleString()} bankroll.`,
        kind: "success",
      });
    } catch (launchError) {
      const message = launchError instanceof Error ? launchError.message : "Unable to launch cohort.";
      toast.error("Launch failed", {
        description: message,
      });
      addNotification({
        title: "Intraday launch failed",
        message,
        kind: "warning",
      });
    } finally {
      setIsLaunchingCohort(false);
    }
  };

  const handleReviewPromotion = () => {
    router.push("/trading?promo=latest");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Assistant Workspace
          <TooltipExplainer 
            term="Assistant Workspace" 
            explanation="Your AI trading advisor that answers questions, explains strategies, and suggests trades. The assistant has access to all your data - forecasts, strategies, performance metrics, and market conditions. It provides evidence-based recommendations with citations you can verify. Ask questions in plain English and get expert-level explanations with supporting data."
          />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chat with the LenQuant assistant, review evidence, and approve grounded trade recommendations.
        </p>
      </div>
      
      {/* Context Panel */}
      <ContextPanel />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <AssistantToolbar
            query={query}
            onQueryChange={setQuery}
            symbol={symbol}
            onSymbolChange={setSymbol}
            strategyId={strategyId}
            onStrategyIdChange={setStrategyId}
            date={date}
            onDateChange={setDate}
            horizon={horizon}
            onHorizonChange={setHorizon}
            isLoading={isLoading}
            onSubmit={handleSubmit}
          />
          <QuickActions
            onSelect={(prompt) => setQuery(prompt)}
            onLaunchIntraday={handleLaunchIntraday}
            onReviewPromotion={handleReviewPromotion}
            isLaunching={isLaunchingCohort}
          />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Conversation
              <TooltipExplainer 
                term="Conversation History" 
                explanation="All your questions and the assistant's answers are saved here. Each answer includes evidence references - click them to see the source data that supports the response. This ensures recommendations are grounded in actual system data, not guesses."
                size="sm"
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {historyError ? (
              <ErrorMessage
                title="Failed to load conversation history"
                message={historyError instanceof Error ? historyError.message : "Unknown error"}
                error={historyError}
                onRetry={() => refreshHistory()}
              />
            ) : history.length === 0 ? (
              <EmptyState
                variant="default"
                title={isEasyMode ? "Start a Conversation" : "No Conversation History"}
                description={
                  isEasyMode
                    ? "Ask the assistant questions about trading, get recommendations, or learn how the platform works. Try asking 'What should I trade?' or 'How does this work?'"
                    : "No conversation history yet. Submit a query to start a conversation with the assistant."
                }
              />
            ) : (
              <>
                <ChatTranscript
                  history={history}
                  onSelectEvidence={(entry) => setSelectedEntry(entry)}
                />
                {historyLoading && <p className="text-xs text-muted-foreground">Refreshing history…</p>}
              </>
            )}
            {error && (
              <ErrorMessage
                title="Request failed"
                message={error}
                onRetry={() => {
                  setError(null);
                  void handleSubmit();
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
      <aside className="space-y-6">
        {/* Proactive Suggestions */}
        <ProactiveSuggestions />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Active Recommendations
              <TooltipExplainer 
                term="Active Recommendations" 
                explanation="These are trade suggestions generated by the assistant. Each recommendation includes the reasoning, expected profit, risk level, and supporting evidence. You can approve (execute the trade), reject (decline it), or modify parameters before approving. This human-in-the-loop approach combines AI intelligence with your judgment."
                size="sm"
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recommendationsError ? (
              <ErrorMessage
                title="Failed to load recommendations"
                message={recommendationsError instanceof Error ? recommendationsError.message : "Unknown error"}
                error={recommendationsError}
                onRetry={() => refreshRecommendations()}
              />
            ) : recommendations.length === 0 ? (
              <EmptyState
                variant="trading"
                title={isEasyMode ? "No Recommendations Yet" : "No Active Recommendations"}
                description={
                  isEasyMode
                    ? "Ask the assistant for trading recommendations, or wait for the system to generate suggestions based on market conditions."
                    : "No pending recommendations. Ask the assistant for trade ideas to generate new ones."
                }
              />
            ) : (
              recommendations.map((recommendation) => (
                <RecommendationCard
                  key={recommendation.rec_id}
                  recommendation={recommendation}
                  onDecision={handleDecision}
                />
              ))
            )}
          </CardContent>
        </Card>
        <PromptTemplatePreview
          query={query}
          symbol={symbol}
          date={date}
          horizon={horizon}
          strategyId={strategyId}
        />
      </aside>
      </div>
      <EvidenceDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
  );
}

export async function getStaticProps() {
  return {
    props: {
      title: "AI Assistant - LenQuant",
      description: "Chat with your AI trading assistant for market insights, strategy advice, and personalized trading recommendations.",
    },
  };
}

