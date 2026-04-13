import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { useAuth } from '@/contexts/AuthContext';
import { useTenantContext } from '@/hooks/useTenantContext';

import {
  decideTenantNovelty,
  listTenantNovelties,
} from '../services/novelties';

import type {
  AttendanceNoveltyRow,
  NoveltyDecisionAction,
  NoveltyDecisionStatus,
  NoveltyFilters,
  NoveltiesKpis,
  UseAttendanceNoveltiesResult,
} from '../types/novelties';

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getDefaultRange(): Pick<NoveltyFilters, 'from' | 'to'> {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    from: toIsoDate(firstDay),
    to: toIsoDate(now),
  };
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function buildKpis(rows: AttendanceNoveltyRow[]): NoveltiesKpis {
  return rows.reduce<NoveltiesKpis>(
    (acc, row) => {
      acc.total += 1;
      const status = (row.decision_status ?? 'pending') as NoveltyDecisionStatus;

      if (status === 'justified') acc.justified += 1;
      else if (status === 'rejected') acc.rejected += 1;
      else acc.pending += 1;

      return acc;
    },
    { total: 0, pending: 0, justified: 0, rejected: 0 },
  );
}

export function useAttendanceNovelties(): UseAttendanceNoveltiesResult {
  const queryClient = useQueryClient();
  const defaultRange = useMemo(() => getDefaultRange(), []);

  const { user } = useAuth();
  const tenantContext = useTenantContext(user?.id);
  const tenantId = tenantContext.data?.tenantId ?? null;

  const [filters, setFiltersState] = useState<NoveltyFilters>({
    search: '',
    from: defaultRange.from,
    to: defaultRange.to,
    department: 'all',
    decisionStatus: 'all',
  });

  const noveltiesQuery = useQuery({
    queryKey: ['attendance', 'tenant-novelties', tenantId, filters.from, filters.to],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) throw new Error('No se pudo resolver el tenant activo del usuario.');
      return listTenantNovelties(tenantId, filters.from, filters.to);
    },
    staleTime: 60_000,
  });

  const decisionMutation = useMutation({
    mutationFn: async ({
      row,
      decision,
      note,
    }: {
      row: AttendanceNoveltyRow;
      decision: NoveltyDecisionAction;
      note: string;
    }) => {
      if (!tenantId) {
        throw new Error('No se pudo resolver el tenant activo del usuario.');
      }

      await decideTenantNovelty({
        tenantId,
        employeeId: row.employee_id,
        workDate: row.work_date,
        decision,
        requestComment: row.request_comment ?? '',
        decisionComment: note,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['attendance', 'tenant-novelties'],
      });
    },
  });

  const allRows = useMemo(() => noveltiesQuery.data ?? [], [noveltiesQuery.data]);

  const departments = useMemo(() => {
    return Array.from(
      new Set(
        allRows
          .map((row) => row.department_name)
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b, 'es'));
  }, [allRows]);

  const rows = useMemo(() => {
    const search = normalizeText(filters.search);

    return allRows.filter((row) => {
      const status = (row.decision_status ?? 'pending') as NoveltyDecisionStatus;

      if (filters.decisionStatus !== 'all' && status !== filters.decisionStatus) return false;
      if (filters.department !== 'all' && (row.department_name ?? '') !== filters.department) return false;

      if (!search) return true;

      const haystack = normalizeText(
        [
          row.employee_name,
          row.employee_code,
          row.department_name,
          row.entry_status,
          row.exit_status,
          row.day_status,
          row.novelty,
          row.request_comment,
          row.decision_comment,
        ]
          .filter(Boolean)
          .join(' '),
      );

      return haystack.includes(search);
    });
  }, [allRows, filters]);

  const kpis = useMemo(() => buildKpis(rows), [rows]);

  const setFilters = (updater: Partial<NoveltyFilters>) => {
    setFiltersState((current) => ({ ...current, ...updater }));
  };

  const resetFilters = () => {
    setFiltersState({
      search: '',
      from: defaultRange.from,
      to: defaultRange.to,
      department: 'all',
      decisionStatus: 'all',
    });
  };

  const refresh = async () => {
    await noveltiesQuery.refetch();
  };

  const submitDecision = async (
    row: AttendanceNoveltyRow,
    decision: NoveltyDecisionAction,
    note: string,
  ) => {
    const trimmed = note.trim();

    if (!trimmed) {
      toast.error('La nota es obligatoria.');
      return;
    }

    await decisionMutation.mutateAsync({ row, decision, note: trimmed });

    toast.success(
      decision === 'justified'
        ? 'Novedad justificada.'
        : 'Novedad rechazada.',
    );
  };

  const errorMessage =
    tenantContext.error
      ? (tenantContext.error as Error).message
      : noveltiesQuery.error
        ? (noveltiesQuery.error as Error).message
        : null;

  return {
    rows,
    allRows,
    filters,
    departments,
    kpis,
    notificationsCount: kpis.pending,
    loading: tenantContext.isLoading || noveltiesQuery.isLoading,
    refreshing: noveltiesQuery.isFetching,
    deciding: decisionMutation.isPending,
    errorMessage,
    setFilters,
    resetFilters,
    refresh,
    submitDecision,
  };
}
