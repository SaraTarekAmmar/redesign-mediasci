import React from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Archive,
  BarChart3,
  Building2,
  CheckSquare2,
  ClipboardCheck,
  FileText,
  FolderKanban,
  GanttChart,
  Handshake,
  Layers,
  Network,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  Workflow,
} from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";

const sections = [
  {
    title: "Identity and organization",
    description: "Control access, organizational structure, and the internal resource directory.",
    items: [
      { to: "/users", label: "Users", detail: "Accounts, activation, roles, and permissions", icon: UsersRound },
      { to: "/departments", label: "Departments", detail: "Department structure and ownership", icon: Building2 },
      { to: "/teams", label: "Internal teams", detail: "Team membership and resource composition", icon: Layers },
      { to: "/resources", label: "Resources", detail: "Internal workforce profiles and availability", icon: Network },
      { to: "/skills", label: "Skills", detail: "Skills taxonomy and workforce capabilities", icon: Activity },
    ],
  },
  {
    title: "Projects and workforce",
    description: "Create projects and explicitly control every internal and external assignment path.",
    items: [
      { to: "/projects", label: "Projects", detail: "Project lifecycle, metadata, and creation", icon: FolderKanban },
      { to: "/workforce", label: "Project workforce", detail: "Teams, resources, partners, teams, and people", icon: UsersRound },
      { to: "/partners", label: "External partners", detail: "Organizations, partner teams, and consultants", icon: Handshake },
      { to: "/clients", label: "Clients", detail: "Client organizations connected to delivery", icon: Building2 },
      { to: "/requests", label: "Requests", detail: "Pre-sales and incoming project requests", icon: ClipboardCheck },
    ],
  },
  {
    title: "Delivery configuration",
    description: "Administer reusable delivery structures and the operational control surfaces.",
    items: [
      { to: "/workflow-templates", label: "Workflows", detail: "Workflow templates and reusable processes", icon: Workflow },
      { to: "/enterprise-gantt", label: "Milestones and plans", detail: "Cross-project plans, milestones, and dependencies", icon: GanttChart },
      { to: "/sprints/global", label: "Sprints", detail: "Global sprint inventory across projects", icon: Layers },
      { to: "/validation", label: "Validation", detail: "Quality rules and validation results", icon: CheckSquare2 },
      { to: "/admin-tasks", label: "Administrative tasks", detail: "Operational administration task queue", icon: ClipboardCheck },
    ],
  },
  {
    title: "Governance and system",
    description: "Review system health and manage configuration with auditable, recoverable controls.",
    items: [
      { to: "/analytics", label: "Analytics", detail: "Portfolio and delivery analytics", icon: BarChart3 },
      { to: "/reports", label: "Reports", detail: "Operational and portfolio reporting", icon: FileText },
      { to: "/custom-fields", label: "Custom fields", detail: "Schema extensions for delivery records", icon: SlidersHorizontal },
      { to: "/recovery", label: "Audit and recovery", detail: "Restore archived records and review recovery state", icon: Archive },
      { to: "/settings", label: "Project settings", detail: "Project governance, calendar, budget, and integration configuration", icon: Settings },
    ],
  },
];

function AdministrationPage() {
  return (
    <div className="h-full overflow-y-auto p-5">
      <PageHeader
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Administration"
        subtitle="The control plane for identity, projects, workforce, delivery configuration, and governance"
      />

      <div className="mx-auto mt-5 max-w-7xl space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{section.description}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item) => (
                <Link
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
                >
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground group-hover:text-primary">{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.detail}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default AdministrationPage;
