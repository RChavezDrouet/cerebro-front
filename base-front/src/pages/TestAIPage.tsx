import { useState } from "react";
import { attendanceService } from "@/services/attendance.service";

export default function TestAIPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await attendanceService.analyzeDay({
        tenant_id: "8cb84ecf-4d74-4aac-84cc-0c66da4aa656",
        date: new Date().toISOString().slice(0, 10),
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Test IA Asistencia</h1>

      <button
        onClick={handleAnalyze}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {loading ? "Analizando..." : "Analizar con IA"}
      </button>

      {error ? (
        <pre className="mt-4 bg-red-50 p-4 rounded text-red-700">{error}</pre>
      ) : null}

      <pre className="mt-4 bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}