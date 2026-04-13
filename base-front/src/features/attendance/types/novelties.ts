export type NoveltyDecisionStatus = 'pending' | 'justified' | 'rejected';
export type NoveltyDecisionAction = Exclude<NoveltyDecisionStatus, 'pending'>;

export interface AttendanceNoveltyRow {
  employee_id: string;
  employee_code: string | null;
  employee_name: string;
  department_name: string | null;
  work_date: string;
  entry_status: string | null;
  exit_status: string | null;
  day_status: string | null;
  novelty: string | null;
  decision_status: NoveltyDecisionStatus | null;
  request_comment: string | null;
  decision_comment: string | null;
  decided_at: string | null;
}

export interface OrgNotificationRow {
  type?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  department_name?: string | null;
  work_date?: string | null;
  event_date?: string | null;
  detail?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

export interface NoveltyFilters {
  search: string;
  from: string;
  to: string;
  department: string;
  decisionStatus: 'all' | NoveltyDecisionStatus;
}

export interface DecideNoveltyInput {
  employeeId: string;
  workDate: string;
  decision: NoveltyDecisionAction;
  requestComment: string;
  decisionComment: string;
}

export interface NoveltiesKpis {
  total: number;
  pending: number;
  justified: number;
  rejected: number;
}

export interface UseAttendanceNoveltiesResult {
  rows: AttendanceNoveltyRow[];
  allRows: AttendanceNoveltyRow[];
  filters: NoveltyFilters;
  departments: string[];
  kpis: NoveltiesKpis;
  notificationsCount: number;
  loading: boolean;
  refreshing: boolean;
  deciding: boolean;
  errorMessage: string | null;
  setFilters: (updater: Partial<NoveltyFilters>) => void;
  resetFilters: () => void;
  refresh: () => Promise<void>;
  submitDecision: (row: AttendanceNoveltyRow, decision: NoveltyDecisionAction, note: string) => Promise<void>;
}
