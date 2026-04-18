import { useCallback, useEffect, useState } from "react";
import {
  payrollService,
  PayrollPeriod,
  PayrollRun,
  PayrollSummaryRow,
} from "@/services/payroll.service";

export function usePayroll() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [summary, setSummary] = useState<PayrollSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBaseData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [periodsData, runsData] = await Promise.all([
        payrollService.getPeriods(),
        payrollService.getRuns(),
      ]);
      setPeriods(periodsData);
      setRuns(runsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar nómina.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async (runId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await payrollService.getSummary(runId);
      setSummary(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el resumen.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateRun = useCallback(
    async (runId: string) => {
      setLoading(true);
      setError(null);
      try {
        await payrollService.calculateRun(runId);
        const data = await payrollService.getSummary(runId);
        setSummary(data);
        await loadBaseData();
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo calcular la corrida.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadBaseData]
  );

  const applyNovelties = useCallback(
    async (runId: string) => {
      setLoading(true);
      setError(null);
      try {
        await payrollService.applyNovelties(runId);
        const data = await payrollService.getSummary(runId);
        setSummary(data);
        await loadBaseData();
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudieron aplicar novedades.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadBaseData]
  );

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  return {
    periods,
    runs,
    summary,
    loading,
    error,
    reload: loadBaseData,
    loadSummary,
    calculateRun,
    applyNovelties,
  };
}