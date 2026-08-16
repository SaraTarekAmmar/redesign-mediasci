import enum


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super-admin"
    ADMIN = "admin"
    PROJECT_MANAGER = "project-manager"
    TEAM_LEADER = "team-leader"
    DEVELOPER = "developer"
    MEMBER = "member"
    VIEWER = "viewer"
    ACCOUNT_MANAGER = "account-manager"
    DEPARTMENT_MANAGER = "department-manager"
    HR_MANAGER = "hr-manager"
    REVIEWER = "reviewer"
    EXECUTIVE = "executive"
    PARTNER = "partner"
    CLIENT = "client"

    @property
    def label(self) -> str:
        return self.value.replace("-", " ").title()

    @property
    def is_admin(self) -> bool:
        return self in (UserRole.SUPER_ADMIN, UserRole.ADMIN)

    @property
    def can_manage_users(self) -> bool:
        return self in (UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEAM_LEADER)


class IssueStatusCategory(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"

    @property
    def label(self) -> str:
        return self.value.replace("_", " ").title()

    @property
    def color(self) -> str:
        return {"todo": "gray", "in_progress": "blue", "review": "orange", "done": "green"}[self.value]


class Priority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

    @property
    def label(self) -> str:
        return self.value.title()

    @property
    def color(self) -> str:
        return {"low": "blue", "medium": "yellow", "high": "orange", "critical": "red"}[self.value]

    @property
    def weight(self) -> int:
        return {"low": 1, "medium": 2, "high": 3, "critical": 4}[self.value]


class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"

    @property
    def label(self) -> str:
        return self.value.title()

    @property
    def color(self) -> str:
        return {"active": "green", "archived": "yellow", "deleted": "red"}[self.value]


class ChangeRequestStatus(str, enum.Enum):
    DRAFT = "Draft"
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    IMPLEMENTED = "Implemented"
    CANCELLED = "Cancelled"

    @property
    def label(self) -> str:
        return self.value

    @property
    def color(self) -> str:
        return {
            "Draft": "gray", "Pending": "yellow", "Approved": "green",
            "Rejected": "red", "Implemented": "blue", "Cancelled": "gray",
        }[self.value]


class StakeholderLevel(str, enum.Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"

    @property
    def label(self) -> str:
        return self.value

    @property
    def weight(self) -> int:
        return {"Low": 1, "Medium": 2, "High": 3}[self.value]


class SprintStatus(str, enum.Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    COMPLETED = "completed"


class TriageStatus(str, enum.Enum):
    NEW = "new"
    TRIAGING = "triaging"
    CONFIRMED = "confirmed"
    DISMISSED = "dismissed"
