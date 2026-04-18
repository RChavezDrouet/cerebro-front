const SUPABASE_FUNCTIONS_URL =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export const attendanceService = {
  async registerPunch(payload: {
    tenant_id: string;
    employee_code: string;
    punch_time: string;
    source: string;
  }) {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/attendance-punch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`attendance-punch ${res.status}: ${text}`);
    }

    return res.json();
  },

  async analyzeDay(payload: {
    tenant_id: string;
    date: string;
  }) {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/attendance-ai-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`attendance-ai-analyze ${res.status}: ${text}`);
    }

    return res.json();
  },
};