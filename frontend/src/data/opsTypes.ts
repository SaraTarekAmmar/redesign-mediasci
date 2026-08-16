
// Types for the extended "operations" domain (risks, resources, budget, stakeholders, etc.)

export type RiskCategory = "technical" | "financial" | "resource" | "schedule" | "external";
export type RiskStatus = "identified" | "analyzing" | "mitigating" | "closed";

export interface Risk {
  id: string;
  title: string;
  description?: string;
  category: RiskCategory;
  probability: number; // 1-5
  impact: number; // 1-5
  status: RiskStatus;
  owner: string;
  responsePlan?: string;
  dueDate?: string;
}

export interface Resource {
  id: string;
  name: string;
  role: string;
  dailyCapacityHours: number;
  costPerHour: number;
  allocationPct: number; // current utilization 0-100+
  color: string;
  isActive: boolean;
}

export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
  paymentType: string;
}

export interface CloudService {
  id: string;
  serviceName: string;
  provider: string;
  planType: string;
  monthlyCost: number;
  renewalDate: string;
  autoRenewal: boolean;
  status: string;
}

export interface SoftwareLicense {
  id: string;
  softwareName: string;
  licenseType: string;
  seats: number;
  monthlyCost: number;
  renewalDate: string;
  department: string;
}

export type InfluenceLevel = "High" | "Medium" | "Low";

export interface Stakeholder {
  id: string;
  name: string;
  organization: string;
  role: string;
  influence: InfluenceLevel;
  interest: InfluenceLevel;
  communicationPreference: string;
  status: "Active" | "Inactive";
  email: string;
}

export interface TimeLog {
  id: string;
  userId: string;
  issueKey: string;
  description: string;
  loggedDate: string;
  durationMinutes: number;
  billable: boolean;
  approved: boolean;
}

export type ChangeStatus = "pending" | "approved" | "rejected" | "implemented";

export interface ChangeRequest {
  id: string;
  code: string;
  title: string;
  description?: string;
  requestedBy: string;
  date: string;
  status: ChangeStatus;
  impact: "Low" | "Medium" | "High";
}

export interface Milestone {
  id: string;
  name: string;
  dueDate: string;
  status: "upcoming" | "in_progress" | "completed" | "at_risk";
  epicId?: string;
}

export interface Deliverable {
  id: string;
  name: string;
  description?: string;
  dueDate?: string;
  status: "Pending" | "In Progress" | "Delivered";
}

export interface Objective {
  id: string;
  title: string;
  status: "Achieved" | "In Progress";
}

export interface Department {
  id: string;
  name: string;
  type: string;
  leaderId: string;
  membersCount: number;
  color: string;
}

export interface ProjectDocument {
  id: string;
  name: string;
  type: string;
  sizeKb: number;
  version: string;
  uploadedById: string;
  updatedAt: string;
}