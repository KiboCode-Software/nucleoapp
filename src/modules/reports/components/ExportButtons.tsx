import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ExportFormat } from "@/services/export";

const FILE_FORMATS: Array<{ format: ExportFormat; label: string }> = [
  { format: "markdown", label: "Markdown" },
  { format: "json", label: "JSON" },
  { format: "csv", label: "CSV" },
];

interface ExportButtonsProps {
  onExport: (format: ExportFormat) => void;
  /** Abre el diálogo de impresión, donde se elige "Guardar como PDF". */
  onPdf: () => void;
}

export function ExportButtons({ onExport, onPdf }: ExportButtonsProps) {
  return (
    <>
      {FILE_FORMATS.map(({ format, label }) => (
        <Button key={format} variant="secondary" onClick={() => onExport(format)} className="px-3">
          <Download className="size-4" /> {label}
        </Button>
      ))}
      <Button variant="secondary" onClick={onPdf} className="px-3" title="Imprimir o guardar como PDF">
        <Printer className="size-4" /> PDF
      </Button>
    </>
  );
}
