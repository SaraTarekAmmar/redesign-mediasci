import React from "react";
import { Activity } from "lucide-react";
import { formatShortDate } from "../SharedUI";

export interface AuditEventItem {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  createdAt?: string | null;
}

interface ActivityFeedProps {
  events: AuditEventItem[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ events }) => {
  return (
    <div className="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Planning Audit Activity Feed
          </h3>
        </div>
        <span className="text-xs text-muted-foreground">Recent Events</span>
      </div>

      {!events || events.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
          No planning activity has been recorded for this project yet.
        </p>
      ) : (
      <div className="space-y-3 relative pl-4 border-l border-border">
        {events.slice(0, 6).map((e) => (
          <div key={e.id} className="relative group">
            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-card" />
            <div className="text-xs">
              <span className="font-semibold text-foreground capitalize">
                {e.action.replace("_", " ")}
              </span>{" "}
              <span className="text-muted-foreground">
                on {e.entityType.replace("_", " ")} #{e.entityId}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                {formatShortDate(e.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
};
