export const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
export const STATUSES = ["To Do", "In Progress", "Blocked", "Done"] as const;
export const ROLES = [
  "Frontend",
  "Backend",
  "Full-Stack",
  "QA",
  "DevOps",
  "Designer",
  "Tech Lead",
] as const;
export const SPRINT_STATES = ["Active", "Upcoming", "Completed"] as const;

export type Severity = (typeof SEVERITIES)[number];
export type Status = (typeof STATUSES)[number];
export type Role = (typeof ROLES)[number];
export type SprintState = (typeof SPRINT_STATES)[number];
/** Calendar date as sent by the API: "YYYY-MM-DD". */
export type ISODate = string;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Developer {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  task_count: number;
  open_task_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProductRef {
  id: string;
  name: string;
  tag: string;
}

export interface Product extends ProductRef {
  description: string | null;
  sprint_count: number;
  task_count: number;
  open_task_count: number;
  tag_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface SprintRef {
  id: string;
  number: number;
  name: string | null;
  start_date: ISODate;
  end_date: ISODate;
}

export interface Sprint extends SprintRef {
  product_id: string;
  product: ProductRef | null;
  goal: string | null;
  state: SprintState;
  task_count: number;
  status_counts: Record<Status, number>;
  created_at: string;
  updated_at: string;
}

export interface DeveloperRef {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
}

export interface Task {
  id: string;
  number: string;
  title: string;
  description: string | null;
  product_id: string;
  sprint_id: string;
  developer_id: string | null;
  product: ProductRef | null;
  sprint: SprintRef | null;
  developer: DeveloperRef | null;
  severity: Severity;
  status: Status;
  start_date: ISODate;
  end_date: ISODate;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export type TaskSort =
  | "number"
  | "-number"
  | "title"
  | "-title"
  | "severity"
  | "-severity"
  | "status"
  | "-status"
  | "start_date"
  | "-start_date"
  | "end_date"
  | "-end_date"
  | "updated_at"
  | "-updated_at";

export interface TaskQuery {
  q?: string;
  product_id?: string;
  sprint_id?: string;
  developer_id?: string;
  severity?: Severity[];
  status?: Status[];
  overdue?: boolean;
  sort?: TaskSort;
  page?: number;
  page_size?: number;
}

export interface DashboardSummary {
  today: ISODate;
  totals: {
    developers: number;
    active_developers: number;
    products: number;
    sprints: number;
    active_sprints: number;
    tasks: number;
    open_tasks: number;
    overdue_tasks: number;
    unassigned_tasks: number;
  };
  tasks_by_status: Record<Status, number>;
  tasks_by_severity: Record<Severity, number>;
  tasks_per_product: {
    product_id: string;
    name: string;
    tag: string;
    total: number;
    done: number;
  }[];
  tasks_per_developer: {
    developer_id: string | null;
    name: string;
    is_active: boolean;
    total: number;
    open: number;
  }[];
  active_sprints: {
    sprint_id: string;
    product_id: string;
    tag: string;
    number: number;
    name: string | null;
    start_date: ISODate;
    end_date: ISODate;
    total: number;
    status_counts: Record<Status, number>;
  }[];
  overdue: Task[];
  due_this_week: Task[];
  recently_updated: Task[];
}

export interface MoveTasksResult {
  moved: number;
  adjusted: number;
  source_deleted: boolean;
  target_sprint_id: string;
}
