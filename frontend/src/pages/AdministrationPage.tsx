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
import { SectionCard } from "../components/common/SectionCard";

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
      { to: "/workforce", label: "Project workforce", detail: "Teams, resources, partners, and people", icon: UsersRound },
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
    title: "Insights and control",
    description: "Review delivery signals, reporting, and reusable data configuration.",
    items: [
      { to: "/analytics", label: "Analytics", detail: "Portfolio and delivery signals", icon: BarChart3 },
      { to: "/reports", label: "Reports", detail: "Operational and portfolio reporting", icon: FileText },
      { to: "/custom-fields", label: "Custom fields", detail: "Schema extensions for delivery records", icon: SlidersHorizontal },
    ],
  },
  {
    title: "System and settings",
    description: "Manage project governance and recoverable system controls.",
    items: [
      { to: "/recovery", label: "Audit and recovery", detail: "Restore archived records and review recovery state", icon: Archive },
      { to: "/settings", label: "Project settings", detail: "Project governance, calendar, workflow, and integrations", icon: Settings },
    ],
  },
];

function AdministrationPage() {
  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
      <PageHeader
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Administration"
        subtitle="The control plane for identity, projects, workforce, delivery configuration, and governance"
      />

      <div className="mt-6 space-y-5">
        {sections.map((section) => (
          <SectionCard
            key={section.title}
            title={<div><p className="text-sm font-bold text-foreground">{section.title}</p><p className="mt-0.5 text-xs font-normal text-muted-foreground">{section.description}</p></div>}
            bodyClassName="pt-4"
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item) => (
                <Link
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
                >
                  <span className="rounded-lg bg-muted p-2 text-foreground">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground group-hover:text-primary">{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.detail}</span>
                  </span>
                </Link>
              ))}
            </div>
          </SectionCard>
        ))}
      </div>
      </div>
    </div>
  );
}

export default AdministrationPage;
