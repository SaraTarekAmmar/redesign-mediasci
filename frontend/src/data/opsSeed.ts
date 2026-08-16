

import type {
  Risk,
  Resource,
  Expense,
  CloudService,
  SoftwareLicense,
  Stakeholder,
  TimeLog,
  ChangeRequest,
  Milestone,
  Deliverable,
  Objective,
  Department,
  ProjectDocument } from
"./opsTypes";

const D: any = (typeof window !== "undefined" && (window as any).__DATA__) || {};

export const expenseCategories = [
{ name: "Development", color: "#3b82f6" },
{ name: "Design", color: "#ec4899" },
{ name: "Hosting", color: "#8b5cf6" },
{ name: "Cloud Services", color: "#06b6d4" },
{ name: "Licenses", color: "#f59e0b" },
{ name: "Marketing", color: "#f97316" }];


export const risks: Risk[] = D.risks ?? [
{
  id: "r1",
  title: "Third-party billing API may deprecate v1",
  description: "Vendor announced v1 sunset; migration to v2 required before Q4.",
  category: "technical",
  probability: 3,
  impact: 5,
  status: "mitigating",
  owner: "Lina Fares",
  responsePlan: "Spike v2 integration in Sprint 25, feature-flag rollout.",
  dueDate: "2026-08-15"
},
{
  id: "r2",
  title: "Key backend engineer on leave during release",
  category: "resource",
  probability: 4,
  impact: 3,
  status: "analyzing",
  owner: "Sara Ammar",
  dueDate: "2026-07-30"
},
{
  id: "r3",
  title: "Onboarding scope creep pushing timeline",
  category: "schedule",
  probability: 3,
  impact: 3,
  status: "identified",
  owner: "Sara Ammar"
},
{
  id: "r4",
  title: "Cloud cost overrun on preview environments",
  category: "financial",
  probability: 2,
  impact: 4,
  status: "mitigating",
  owner: "Karim Saleh",
  responsePlan: "Auto-teardown idle preview deploys after 24h."
},
{
  id: "r5",
  title: "GDPR review pending for reporting exports",
  category: "external",
  probability: 2,
  impact: 5,
  status: "identified",
  owner: "Sara Ammar",
  dueDate: "2026-09-01"
},
{
  id: "r6",
  title: "Flaky CI causing false build failures",
  category: "technical",
  probability: 4,
  impact: 2,
  status: "closed",
  owner: "Karim Saleh"
}];


export const resources: Resource[] = D.resources ?? [];


export const expenses: Expense[] = D.expenses ?? [
{ id: "ex1", title: "Figma organization plan", category: "Design", amount: 540, currency: "USD", date: "2026-07-01", paymentType: "Card" },
{ id: "ex2", title: "AWS - July compute", category: "Hosting", amount: 3210, currency: "USD", date: "2026-07-05", paymentType: "Invoice" },
{ id: "ex3", title: "Contractor - onboarding illustrations", category: "Design", amount: 1800, currency: "USD", date: "2026-07-08", paymentType: "Bank transfer" },
{ id: "ex4", title: "Datadog monitoring", category: "Cloud Services", amount: 690, currency: "USD", date: "2026-07-10", paymentType: "Card" },
{ id: "ex5", title: "LinkedIn ad campaign", category: "Marketing", amount: 1250, currency: "USD", date: "2026-07-14", paymentType: "Card" }];


export const cloudServices: CloudService[] = D.cloudServices ?? [
{ id: "cs1", serviceName: "AWS EC2 + RDS", provider: "Amazon", planType: "On-demand", monthlyCost: 3200, renewalDate: "2026-08-01", autoRenewal: true, status: "active" },
{ id: "cs2", serviceName: "Datadog APM", provider: "Datadog", planType: "Pro", monthlyCost: 690, renewalDate: "2026-08-10", autoRenewal: true, status: "active" },
{ id: "cs3", serviceName: "Cloudflare", provider: "Cloudflare", planType: "Business", monthlyCost: 200, renewalDate: "2026-09-01", autoRenewal: false, status: "active" }];


export const softwareLicenses: SoftwareLicense[] = D.softwareLicenses ?? [
{ id: "sl1", softwareName: "Figma", licenseType: "Organization", seats: 12, monthlyCost: 540, renewalDate: "2027-01-01", department: "Design" },
{ id: "sl2", softwareName: "GitHub Enterprise", licenseType: "Per seat", seats: 20, monthlyCost: 420, renewalDate: "2026-11-15", department: "Engineering" },
{ id: "sl3", softwareName: "Linear", licenseType: "Standard", seats: 15, monthlyCost: 120, renewalDate: "2026-10-01", department: "Product" }];


export const stakeholders: Stakeholder[] = D.stakeholders ?? [
{ id: "st1", name: "Dr. Hana Mostafa", organization: "MediaSci Board", role: "Sponsor", influence: "High", interest: "High", communicationPreference: "Meeting", status: "Active", email: "hana@mediasci.co" },
{ id: "st2", name: "Tarek Amir", organization: "Acme Corp", role: "Client", influence: "High", interest: "Medium", communicationPreference: "Email", status: "Active", email: "tarek@acme.com" },
{ id: "st3", name: "Nadia Fouad", organization: "Legal & Compliance", role: "Consultant", influence: "Medium", interest: "High", communicationPreference: "Email", status: "Active", email: "nadia@mediasci.co" },
{ id: "st4", name: "Sam Rivera", organization: "Growth Partners", role: "Manager", influence: "Low", interest: "High", communicationPreference: "Phone", status: "Active", email: "sam@growth.io" },
{ id: "st5", name: "Ivy Chen", organization: "Beta Customer", role: "Client", influence: "Medium", interest: "Low", communicationPreference: "System Notification", status: "Inactive", email: "ivy@betaco.com" }];


export const timeLogs: TimeLog[] = D.timeLogs ?? [
{ id: "tl1", userId: "u2", issueKey: "MSCI-101", description: "Step navigation component", loggedDate: "2026-07-19", durationMinutes: 210, billable: true, approved: true },
{ id: "tl2", userId: "u3", issueKey: "MSCI-102", description: "Persist onboarding state to server", loggedDate: "2026-07-19", durationMinutes: 150, billable: true, approved: false },
{ id: "tl3", userId: "u3", issueKey: "MSCI-104", description: "Debug proration rounding", loggedDate: "2026-07-18", durationMinutes: 320, billable: true, approved: true },
{ id: "tl4", userId: "u5", issueKey: "MSCI-105", description: "Empty state illustrations", loggedDate: "2026-07-18", durationMinutes: 180, billable: false, approved: true },
{ id: "tl5", userId: "u4", issueKey: "MSCI-106", description: "Reducer unit tests", loggedDate: "2026-07-17", durationMinutes: 240, billable: true, approved: true },
{ id: "tl6", userId: "u6", issueKey: "MSCI-107", description: "CI preview pipeline", loggedDate: "2026-07-16", durationMinutes: 420, billable: true, approved: true }];


export const changeRequests: ChangeRequest[] = D.changeRequests ?? [
{ id: "cr1", code: "CR-014", title: "Add SSO login for enterprise clients", description: "Acme requires SAML SSO before rollout.", requestedBy: "Tarek Amir", date: "2026-07-15", status: "pending", impact: "High" },
{ id: "cr2", code: "CR-013", title: "Change invoice currency to multi-currency", requestedBy: "Sara Ammar", date: "2026-07-12", status: "approved", impact: "Medium" },
{ id: "cr3", code: "CR-012", title: "Postpone CSV export to next release", requestedBy: "Omar Khaled", date: "2026-07-10", status: "approved", impact: "Low" },
{ id: "cr4", code: "CR-011", title: "Rebrand onboarding to match new logo", requestedBy: "Mona Adel", date: "2026-07-08", status: "implemented", impact: "Low" },
{ id: "cr5", code: "CR-010", title: "Drop legacy IE11 support", requestedBy: "Karim Saleh", date: "2026-07-05", status: "rejected", impact: "Medium" }];


export const milestones: Milestone[] = D.milestones ?? [
{ id: "m1", name: "Onboarding beta launch", dueDate: "2026-07-27", status: "in_progress", epicId: "e1" },
{ id: "m2", name: "Billing GA", dueDate: "2026-08-20", status: "upcoming", epicId: "e2" },
{ id: "m3", name: "Reporting MVP", dueDate: "2026-09-10", status: "upcoming", epicId: "e3" },
{ id: "m4", name: "Q3 compliance sign-off", dueDate: "2026-08-01", status: "at_risk" },
{ id: "m5", name: "Public API v1", dueDate: "2026-06-30", status: "completed" }];


export const deliverables: Deliverable[] = D.deliverables ?? [
{ id: "d1", name: "Onboarding flow (3 steps)", description: "Guided wizard with resume support.", dueDate: "2026-07-27", status: "In Progress" },
{ id: "d2", name: "Branded PDF invoices", dueDate: "2026-08-05", status: "Pending" },
{ id: "d3", name: "Reporting dashboard MVP", dueDate: "2026-09-10", status: "Pending" },
{ id: "d4", name: "CI/CD preview environments", dueDate: "2026-07-10", status: "Delivered" }];


export const objectives: Objective[] = D.objectives ?? [
{ id: "o1", title: "Reduce onboarding drop-off by 30%", status: "In Progress" },
{ id: "o2", title: "Automate monthly invoicing", status: "In Progress" },
{ id: "o3", title: "Ship self-serve reporting", status: "In Progress" },
{ id: "o4", title: "Establish CI/CD baseline", status: "Achieved" }];


export const scopeMeta = D.scopeMeta ?? {
  name: "MediaSci Platform - Statement of Work",
  status: "Approved" as const,
  version: "2.1.0",
  summary:
  "Deliver a self-serve operations platform covering onboarding, billing, and reporting for MediaSci and its enterprise clients.",
  inScope: [
  "Guided multi-step onboarding with progress persistence",
  "Automated, branded invoicing and proration",
  "Self-serve reporting dashboard with CSV export",
  "CI/CD preview environments"],

  outOfScope: [
  "Native mobile applications",
  "On-premise deployment",
  "Multi-language localization (phase 2)"]

};

export const departments: Department[] = D.departments ?? [];


export const documents: ProjectDocument[] = D.documents ?? [
{ id: "doc1", name: "Product Requirements - Onboarding.pdf", type: "PDF", sizeKb: 842, version: "3.2", uploadedById: "u1", updatedAt: "2026-07-18" },
{ id: "doc2", name: "Billing architecture.excalidraw", type: "Diagram", sizeKb: 210, version: "1.4", uploadedById: "u3", updatedAt: "2026-07-15" },
{ id: "doc3", name: "Brand guidelines.pdf", type: "PDF", sizeKb: 5120, version: "2.0", uploadedById: "u5", updatedAt: "2026-06-30" },
{ id: "doc4", name: "Q3 roadmap.xlsx", type: "Spreadsheet", sizeKb: 96, version: "1.1", uploadedById: "u1", updatedAt: "2026-07-12" },
{ id: "doc5", name: "Security review checklist.docx", type: "Document", sizeKb: 64, version: "1.0", uploadedById: "u6", updatedAt: "2026-07-09" }];
