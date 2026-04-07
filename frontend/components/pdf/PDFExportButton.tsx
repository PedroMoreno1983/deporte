"use client";
import dynamic from "next/dynamic";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";

// @react-pdf/renderer must NOT be SSR'd
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => null }
);

interface Props {
  document: React.ReactElement;
  fileName: string;
  label?: string;
}

export function PDFExportButton({ document, fileName, label = "Exportar PDF" }: Props) {
  const [ready, setReady] = useState(false);

  return (
    <PDFDownloadLink document={document} fileName={fileName}>
      {({ loading, url }) => {
        if (!ready && url) setReady(true);
        return (
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: loading ? "rgba(255,255,255,0.06)" : "rgba(255,59,48,0.12)",
              border: "1px solid rgba(255,59,48,0.3)",
              color: loading ? "rgba(255,255,255,0.4)" : "#ff3b30",
              cursor: loading ? "wait" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = "rgba(255,59,48,0.2)";
                e.currentTarget.style.boxShadow = "0 0 16px rgba(255,59,48,0.2)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = loading ? "rgba(255,255,255,0.06)" : "rgba(255,59,48,0.12)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            {loading ? "Generando..." : label}
          </button>
        );
      }}
    </PDFDownloadLink>
  );
}
