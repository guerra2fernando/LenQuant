/* eslint-disable */
// @ts-nocheck
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink, 
  Download, 
  TrendingUp, 
  Target, 
  Settings, 
  BarChart3,
  Clock,
  CheckCircle
} from "lucide-react";
import { useRouter } from "next/router";
import { toast } from "sonner";

type KnowledgeEntry = {
  _id?: string;
  summary?: string;
  created_at?: string;
  tags?: string[];
  strategy_id?: string;
  symbol?: string;
  insight_type?: "feature_importance" | "correlation" | "performance" | "risk" | "allocation";
  action_suggested?: string;
  is_winner?: boolean;
  relevance_score?: number;
};

type Props = {
  entry: KnowledgeEntry;
  onExport?: (entry: KnowledgeEntry) => void;
};

export function EnhancedKnowledgeCard({ entry, onExport }: Props) {
  const router = useRouter();

  const handleApplyInsight = () => {
    // Determine where to navigate based on insight type
    switch (entry.insight_type) {
      case "feature_importance":
        router.push("/analytics?tab=insights");
        break;
      case "allocation":
        router.push("/analytics?tab=strategies");
        break;
      case "performance":
        if (entry.strategy_id) {
          router.push(`/analytics?tab=strategies&strategy=${entry.strategy_id}`);
        } else {
          router.push("/portfolio");
        }
        break;
      case "risk":
        router.push("/risk");
        break;
      default:
        router.push("/analytics");
    }
    toast.info("Navigated to relevant page");
  };

  const handleExport = () => {
    if (onExport) {
      onExport(entry);
    } else {
      // Default export as JSON
      const blob = new Blob([JSON.stringify(entry, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `insight_${entry._id || Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Insight exported");
    }
  };

  const getInsightTypeIcon = () => {
    switch (entry.insight_type) {
      case "feature_importance":
        return <BarChart3 className="h-4 w-4" />;
      case "allocation":
        return <Target className="h-4 w-4" />;
      case "performance":
        return <TrendingUp className="h-4 w-4" />;
      case "risk":
        return <Settings className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getInsightTypeLabel = () => {
    switch (entry.insight_type) {
      case "feature_importance":
        return "Feature Importance";
      case "allocation":
        return "Allocation";
      case "performance":
        return "Performance";
      case "risk":
        return "Risk";
      case "correlation":
        return "Correlation";
      default:
        return "Insight";
    }
  };

  const isRelevantToCurrentMarket = entry.relevance_score && entry.relevance_score > 0.7;

  return (
    <Card className={`border ${isRelevantToCurrentMarket ? "border-l-4 border-l-green-500" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {getInsightTypeIcon()}
                <span className="ml-1">{getInsightTypeLabel()}</span>
              </Badge>
              
              {entry.is_winner && (
                <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-xs">
                  Winner
                </Badge>
              )}

              {isRelevantToCurrentMarket && (
                <Badge variant="outline" className="border-green-500 text-green-600 text-xs">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Similar to Current Market
                </Badge>
              )}

              {entry.symbol && (
                <Badge variant="outline" className="text-xs">
                  {entry.symbol}
                </Badge>
              )}
            </div>

            {entry.tags && entry.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {entry.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {entry.created_at && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(entry.created_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed">{entry.summary || "No summary available"}</p>

        {entry.action_suggested && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs font-medium text-blue-900">💡 Suggested Action:</p>
            <p className="text-xs text-blue-800 mt-1">{entry.action_suggested}</p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" variant="default" onClick={handleApplyInsight}>
            <ExternalLink className="mr-2 h-3 w-3" />
            Apply This Insight
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-3 w-3" />
            Export
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

