"use client";
/**
 * Generic data-export helpers for tables shown in the dashboard.
 * - CSV: synchronous, dependency-light, RFC-4180 quoting
 * - Excel: uses SheetJS (xlsx) — single sheet, can be extended to multi-sheet
 *
 * Usage:
 *   exportToCSV(rows, "players.csv");
 *   exportToExcel({ Plantel: rows }, "deporte_plantel.xlsx");
 */
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

export type Row = Record<string, any>;

function escapeCSV(value: any): string {
  if (value == null) return "";
  let s = String(value);
  if (typeof value === "object") {
    try { s = JSON.stringify(value); } catch { s = String(value); }
  }
  const needsQuoting = /[",\r\n]/.test(s);
  s = s.replace(/"/g, '""');
  return needsQuoting ? `"${s}"` : s;
}

/** Export a flat row array to CSV. */
export function exportToCSV(rows: Row[], filename: string, columns?: string[]) {
  if (!rows.length) {
    return;
  }
  const cols = columns ?? Object.keys(rows[0]);
  const header = cols.join(",");
  const lines = rows.map((r) => cols.map((c) => escapeCSV(r[c])).join(","));
  // BOM so Excel detects UTF-8 properly
  const csv = "﻿" + header + "\n" + lines.join("\n");
  saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

/** Export one or more sheets to an .xlsx workbook. */
export function exportToExcel(sheets: Record<string, Row[]>, filename: string) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows);
    // Mild styling: column auto-width via wch
    const cols = rows[0] ? Object.keys(rows[0]) : [];
    (ws as any)["!cols"] = cols.map((c) => {
      const max = Math.min(
        Math.max(
          c.length,
          ...rows.map((r) => String(r[c] ?? "").length),
        ),
        40,
      );
      return { wch: max + 2 };
    });
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); // Excel limit
  }
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename,
  );
}

/** Generic export dropdown helper — pass JSX from caller. */
export type ExportFormat = "csv" | "xlsx";
