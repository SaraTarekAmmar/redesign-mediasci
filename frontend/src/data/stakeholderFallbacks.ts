import { stakeholders as seededStakeholders } from "./opsSeed";
import type { InfluenceLevel, Stakeholder } from "./opsTypes";

const levelScore: Record<InfluenceLevel, number> = { Low: 1, Medium: 2, High: 3 };

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarFor(name: string, accent: string) {
  const initials = getInitials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="24" fill="${accent}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="white">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function supportLevelFor(stakeholder: Stakeholder) {
  if (stakeholder.status !== "Active") return "Neutral";
  const score = levelScore[stakeholder.influence] + levelScore[stakeholder.interest];
  if (score >= 5) return "Supporter";
  if (score <= 2) return "Opponent";
  return "Neutral";
}

function engagementLevelFor(stakeholder: Stakeholder) {
  const score = levelScore[stakeholder.influence] + levelScore[stakeholder.interest];
  if (score >= 5) return "High";
  if (score >= 3) return "Medium";
  return "Low";
}

function stakeholderTypeFor(stakeholder: Stakeholder) {
  return stakeholder.organization.toLowerCase().includes("mediasci") ? "Internal" : "External";
}

function createdDateFor(index: number) {
  return `2026-07-${String(4 + index).padStart(2, "0")}T10:00:00Z`;
}

function interactionCountFor(stakeholder: Stakeholder) {
  return stakeholder.status === "Active" ? levelScore[stakeholder.interest] + levelScore[stakeholder.influence] : 1;
}

function projectNamesFor(stakeholder: Stakeholder) {
  const internal = stakeholderTypeFor(stakeholder) === "Internal";
  if (internal) return ["E-Commerce Platform"];
  if (stakeholder.role === "Client") return ["Client Delivery"];
  return ["Operations Hub"];
}

export const fallbackStakeholders = Array.isArray(seededStakeholders) ? seededStakeholders : [];

export function buildStakeholderAnalyticsFallback() {
  const byRole: Record<string, number> = {};
  const byProject: Record<string, number> = {};
  const supportLevel: Record<string, number> = {};
  const type: Record<string, number> = {};
  const category: Record<string, number> = {};
  const engagementLevel: Record<string, number> = {};

  fallbackStakeholders.forEach((stakeholder) => {
    byRole[stakeholder.role] = (byRole[stakeholder.role] ?? 0) + 1;
    projectNamesFor(stakeholder).forEach((project) => {
      byProject[project] = (byProject[project] ?? 0) + 1;
    });
    const support = supportLevelFor(stakeholder);
    supportLevel[support] = (supportLevel[support] ?? 0) + 1;
    const typeValue = stakeholderTypeFor(stakeholder);
    type[typeValue] = (type[typeValue] ?? 0) + 1;
    category[stakeholder.organization] = (category[stakeholder.organization] ?? 0) + 1;
    const engagement = engagementLevelFor(stakeholder);
    engagementLevel[engagement] = (engagementLevel[engagement] ?? 0) + 1;
  });

  return {
    total: fallbackStakeholders.length,
    byRole,
    byProject,
    supportLevel,
    type,
    category,
    engagementLevel,
    activity: fallbackStakeholders.map((stakeholder, index) => ({
      date: createdDateFor(index).slice(0, 10),
      count: interactionCountFor(stakeholder),
    })),
  };
}

export function buildStakeholderRegistrationFallback() {
  return fallbackStakeholders.map((stakeholder, index) => ({
    id: stakeholder.id,
    name: stakeholder.name,
    type: stakeholderTypeFor(stakeholder),
    category: stakeholder.organization || null,
    role: stakeholder.role || null,
    projects: projectNamesFor(stakeholder),
    influenceLevel: stakeholder.influence,
    interestLevel: stakeholder.interest,
    supportLevel: supportLevelFor(stakeholder),
    status: stakeholder.status,
    createdAt: createdDateFor(index),
  }));
}

export function buildStakeholderEngagementFallback() {
  const stakeholders = fallbackStakeholders.map((stakeholder, index) => {
    const count = interactionCountFor(stakeholder);
    return {
      id: stakeholder.id,
      name: stakeholder.name,
      photoUrl: avatarFor(stakeholder.name, index % 2 === 0 ? "#0C66E4" : "#10b981"),
      projects: projectNamesFor(stakeholder),
      interactionsCount: count,
      lastInteractionDate: stakeholder.status === "Active" ? `2026-07-${String(18 + index).padStart(2, "0")}T09:30:00Z` : null,
      engagementLevel: engagementLevelFor(stakeholder) as "High" | "Medium" | "Low",
    };
  });

  const interactions = stakeholders.flatMap((stakeholder, index) => {
    if (stakeholder.interactionsCount <= 0) return [];
    return [
      {
        id: `fallback-interaction-${stakeholder.id}`,
        stakeholderId: stakeholder.id,
        stakeholderName: stakeholder.name,
        type: index % 2 === 0 ? "Meeting" : "Email",
        description: `Follow-up with ${stakeholder.name} about delivery priorities.`,
        occurredAt: stakeholder.lastInteractionDate ?? createdDateFor(index),
      },
    ];
  });

  return { stakeholders, interactions };
}

export function buildStakeholderImpactFallback() {
  const support: Record<string, number> = {};
  const influenceComms = fallbackStakeholders.map((stakeholder, index) => {
    const interactions = interactionCountFor(stakeholder);
    const supportValue = supportLevelFor(stakeholder);
    support[supportValue] = (support[supportValue] ?? 0) + 1;
    return {
      x: levelScore[stakeholder.influence] * 30,
      y: levelScore[stakeholder.interest] * 25,
      r: interactions,
      name: stakeholder.name,
      influence: stakeholder.influence,
      score: levelScore[stakeholder.interest] * 25,
      interactions,
    };
  });

  const engagementFreq = fallbackStakeholders.map((stakeholder) => ({
    x: interactionCountFor(stakeholder),
    y: levelScore[stakeholder.interest] + levelScore[stakeholder.influence],
    name: stakeholder.name,
    position: supportLevelFor(stakeholder),
  }));

  const responseTime = fallbackStakeholders.map((stakeholder) => ({
    name: stakeholder.name,
    value: interactionCountFor(stakeholder) * 6,
  }));

  return {
    impactData: {
      budget: 58,
      schedule: 64,
      scope: 52,
      risk: 49,
      comms: 68,
    },
    charts: {
      influenceComms,
      engagementFreq,
      support,
      responseTime,
    },
    alerts: fallbackStakeholders
      .filter((stakeholder) => stakeholder.status !== "Active" || supportLevelFor(stakeholder) === "Opponent")
      .map((stakeholder) => ({
        type: "attention",
        message: `${stakeholder.name} needs follow-up before the next milestone review.`,
        stakeholderId: stakeholder.id,
        stakeholderName: stakeholder.name,
      })),
    insights: [
      {
        type: "summary",
        title: "Stakeholder coverage is available",
        message: "This view is using seeded stakeholder data until the protected analytics API is available.",
      },
    ],
    recommendations: fallbackStakeholders.map((stakeholder) => ({
      name: stakeholder.name,
      quadrant: supportLevelFor(stakeholder),
      rec: `${stakeholder.communicationPreference || "Email"} is the preferred follow-up channel.`,
    })),
  };
}

export function buildStakeholderDetailFallback(id: string) {
  const stakeholder = fallbackStakeholders.find((item) => item.id === id);
  if (!stakeholder) return null;

  const index = fallbackStakeholders.findIndex((item) => item.id === id);
  const supportLevel = supportLevelFor(stakeholder) as "Supporter" | "Neutral" | "Opponent";
  const engagementLevel = engagementLevelFor(stakeholder);
  const interactionsCount = interactionCountFor(stakeholder);

  return {
    id: stakeholder.id,
    name: stakeholder.name,
    email: stakeholder.email,
    phone: null,
    organization: stakeholder.organization || null,
    role: stakeholder.role || null,
    department: stakeholderTypeFor(stakeholder) === "Internal" ? "Operations" : null,
    photoUrl: avatarFor(stakeholder.name, "#0C66E4"),
    influenceLevel: stakeholder.influence,
    interestLevel: stakeholder.interest,
    communicationPreference: stakeholder.communicationPreference,
    status: stakeholder.status,
    notes: `${stakeholder.name} is available from seeded stakeholder data.`,
    type: stakeholderTypeFor(stakeholder),
    category: stakeholder.organization,
    supportLevel,
    engagementScore: interactionsCount,
    engagementLevel,
    impact: {
      budgetImpact: levelScore[stakeholder.influence] * 20,
      scheduleImpact: levelScore[stakeholder.interest] * 20,
      scopeImpact: (levelScore[stakeholder.influence] + 1) * 15,
      riskImpact: supportLevel === "Opponent" ? 70 : 35,
      communicationScore: levelScore[stakeholder.interest] * 25,
    },
    projects: projectNamesFor(stakeholder).map((name, projectIndex) => ({
      id: `fallback-project-${stakeholder.id}-${projectIndex}`,
      name,
      key: `PRJ-${projectIndex + 1}`,
      status: stakeholder.status === "Active" ? "Active" : "Paused",
    })),
    interactions: interactionsCount > 0
      ? [
          {
            id: `fallback-timeline-${stakeholder.id}`,
            type: stakeholder.communicationPreference || "Email",
            description: `Last recorded touchpoint with ${stakeholder.name}.`,
            occurredAt: `2026-07-${String(18 + Math.max(index, 0)).padStart(2, "0")}T11:00:00Z`,
            userName: "System seed",
          },
        ]
      : [],
    messages: [
      {
        id: `fallback-message-${stakeholder.id}`,
        subject: `Welcome ${stakeholder.name}`,
        message: `This stakeholder is currently shown from the seeded workspace data.`,
        createdAt: createdDateFor(Math.max(index, 0)),
        senderName: "Operation Hub",
      },
    ],
  };
}
