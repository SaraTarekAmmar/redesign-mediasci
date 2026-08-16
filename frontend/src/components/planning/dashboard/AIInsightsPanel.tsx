import React from "react";
import { Sparkles, Lightbulb, TrendingUp } from "lucide-react";
import { Badge } from "../../ui/Badge";

export interface AIInsightData {
  summaryText?: string;
  predictedDelayDays?: number;
  mainCause?: string | null;
  confidence?: string | null;
  recommendationText?: string;
}

interface AIInsightsPanelProps {
  insight: AIInsightData;
}

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ insight }) => {
  const delayDays = insight.predictedDelayDays || 0;
  const isDelayed = delayDays > 0;

  return (
    <div className="p-6 rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/15 text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              AI Planning Intelligence & Insights
            </h3>
            <p className="text-xs text-muted-foreground">
              Automated execution prediction engine based on live velocity trends
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs border-primary/40 text-primary">
          Confidence: {insight.confidence || "—"}
        </Badge>
      </div>

      {/* Prediction Alert Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card/80 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 text-primary" />
            Schedule Forecast Prediction
          </div>
          <p className="text-sm font-semibold text-foreground">
            {isDelayed
              ? `Project is predicted to complete ${delayDays} days past initial target baseline.`
              : "Project execution velocity is currently on target for baseline completion."}
          </p>
          {insight.mainCause && (
            <p className="text-xs text-muted-foreground">
              Primary Bottleneck: <strong className="text-foreground">{insight.mainCause}</strong>
            </p>
          )}
        </div>

        {/* Recommended Action Card */}
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            <Lightbulb className="w-4 h-4" />
            Executive Optimization Recommendation
          </div>
          <p className="text-sm font-medium text-foreground">
            {insight.recommendationText ||
              "No executive recommendation is available from planning intelligence yet."}
          </p>
        </div>
      </div>
    </div>
  );
};
