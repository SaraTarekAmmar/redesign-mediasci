


import React from "react";
import { Avatar, AvatarFallback } from "../ui/Avatar";
import { lookups } from "../../store/useStore";
import { cn } from "../../lib/utils";

// Deterministic accent color per user so avatars are recognizable at a glance.
const palette = ["#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6"];

interface Props {
  userId?: string;
  /** Falls back to this when userId is absent — an issue assigned to a partner (external
   * assignee) has no internal userId, only this. Renders with a dashed ring instead of a
   * solid one so "external" reads at a glance instead of looking like a broken avatar. */
  externalId?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export const UserAvatar = React.memo(function UserAvatar({ userId, externalId, size = "default", className }: Props) {
  const user = userId ? lookups.userById[userId] : undefined;
  const idx = user ? Number(user.id.replace(/\D/g, "")) % palette.length : 0;

  if (!user && externalId) {
    const member = lookups.partnerMemberById[externalId];
    if (member) {
      const initials = member.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();
      return (
        <Avatar size={size} className={cn("border-2 border-dashed border-primary/50", className)} title={`${member.name} · ${member.partnerName || "Partner"}`}>
          <AvatarFallback className="bg-primary/10 font-medium text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      );
    }
  }

  if (!user) {
    return (
      <Avatar size={size} className={cn("border border-dashed border-border", className)}>
        <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">?</AvatarFallback>
      </Avatar>);

  }

  return (
    <Avatar size={size} className={className} title={`${user.name} · ${user.role}`}>
      <AvatarFallback
        className="text-white font-medium"
        style={{ backgroundColor: palette[idx] }}>
        
        {user.initials}
      </AvatarFallback>
    </Avatar>);
});