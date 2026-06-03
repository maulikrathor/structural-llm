// pages/index.tsx
import { useState } from "react";
import ImageUpload from "../components/ImageUpload";
import ResultTables from "../components/ResultTables";

interface Corner {
  label: string;
  x: number;
  y: number;
}

interface Segment {
  number: number;
  end1: string;
  end2: string;
}

interface Analysis {
  section_type: string;
  unit: string;
  dimensions_read: Record<string, number>;
  corners: Corner[];
  line_segments: Segment[];
  warnings: string[];
}

interface Result {
  analysis: Analysis;
  exports: {
    excel_b64: string;
    dxf_b64: string;
  };
}

export default function Home() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiUrl}/api/analyze`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function downloadFile(b64: string, filename: string, mime: string) {
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container">
      <header>
        <h1>Structural Section Analyzer</h1>
        <p>Upload a 2D structural section drawing to extract coordinates and line segments.</p>
      </header>

      <ImageUpload onUpload={handleUpload} loading={loading} />

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="results">
          <div className="result-header">
            <h2>
              {result.analysis.section_type} &nbsp;
              <span className="badge">{result.analysis.unit}</span>
            </h2>

            {result.analysis.warnings.length > 0 && (
              <div className="warnings">
                {result.analysis.warnings.map((w, i) => (
                  <div key={i} className="warning">⚠ {w}</div>
                ))}
              </div>
            )}

            <div className="downloads">
              <button
                onClick={() => downloadFile(result.exports.excel_b64, "structural_analysis.xlsx",
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
              >
                ↓ Download Excel
              </button>
              <button
                onClick={() => downloadFile(result.exports.dxf_b64, "structural_analysis.dxf",
                  "application/dxf")}
              >
                ↓ Download DXF
              </button>
            </div>
          </div>

          <ResultTables
            corners={result.analysis.corners}
            segments={result.analysis.line_segments}
            unit={result.analysis.unit}
          />
        </div>
      )}
    </div>
  );
}
