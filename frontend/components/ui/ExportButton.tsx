"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import { exportToCSV, exportToExcel, type Row } from "@/lib/export";
import { trackEvent } from "@/lib/observability";

interface ExportButtonProps {
  /** Sheet name → row array. Use a single key for CSV export (only first sheet). */
  sheets: Record<string, Row[]>;
  /** File base name without extension. */
  filename: string;
  label?: string;
  disabled?: boolean;
}

export function ExportButton({
  sheets, filename, label = "Exportar", disabled,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const totalRows = Object.values(sheets).reduce((sum, s) => sum + s.length, 0);

  function pickCSV() {
    const firstKey = Object.keys(sheets)[0];
    const rows = sheets[firstKey] ?? [];
    exportToCSV(rows, `${filename}.csv`);
    trackEvent("export.csv", { filename, rows: rows.length });
    setOpen(false);
  }
  function pickExcel() {
    exportToExcel(sheets, `${filename}.xlsx`);
    trackEvent("export.xlsx", { filename, rows: totalRows, sheets: Object.keys(sheets).length });
    setOpen(false);
  }

  const isEmpty = totalRows === 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || isEmpty}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
        style={{
          background: open ? "rgba(0,255,135,0.15)" : "rgba(0,255,135,0.08)",
          border: `1px solid ${open ? "rgba(0,255,135,0.45)" : "rgba(0,255,135,0.25)"}`,
          color: "#00ff87",
        }}
      >
        <Download className="w-3.5 h-3.5" />
        {label}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden glass z-30"
            style={{
              width: 200,
              border: "1px solid rgba(0,255,135,0.25)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.6), 0 0 16px rgba(0,255,135,0.15)",
            }}
          >
            <button
              onClick={pickExcel}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors hover:bg-white/[0.04]"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              <FileSpreadsheet className="w-4 h-4" style={{ color: "#00ff87" }} />
              <div>
                <div className="font-bold">Excel (.xlsx)</div>
                <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {Object.keys(sheets).length} hoja{Object.keys(sheets).length > 1 ? "s" : ""} · {totalRows} filas
                </div>
              </div>
            </button>
            <button
              onClick={pickCSV}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors hover:bg-white/[0.04]"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              <FileText className="w-4 h-4" style={{ color: "#0ea5e9" }} />
              <div>
                <div className="font-bold">CSV (.csv)</div>
                <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Una sola hoja
                </div>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
