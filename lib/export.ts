import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadBlob(content: BlobPart, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface AssignmentGradesExportRow {
  rollNumber: string;
  studentName: string;
  submissionStatus: string;
  submittedAt: string;
  lateStatus: string;
  automaticGrade: string;
  finalGrade: string;
  reviewStatus: string;
  feedback: string;
}

const ASSIGNMENT_GRADES_COLUMNS = [
  "Roll Number",
  "Student Name",
  "Submission Status",
  "Submitted At",
  "Late Status",
  "Automatic Grade",
  "Final Grade",
  "Review Status",
  "Feedback",
];

function csvCell(value: string): string {
  // RFC 4180: quote any field containing a comma, quote, or newline; double
  // up embedded quotes.
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Per-assignment roster export — deliberately excludes internal IDs. */
export function exportAssignmentGradesToCsv(rows: AssignmentGradesExportRow[], filename: string) {
  const lines = [
    ASSIGNMENT_GRADES_COLUMNS.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        row.rollNumber,
        row.studentName,
        row.submissionStatus,
        row.submittedAt,
        row.lateStatus,
        row.automaticGrade,
        row.finalGrade,
        row.reviewStatus,
        row.feedback,
      ]
        .map(csvCell)
        .join(",")
    ),
  ];
  // Leading BOM so Excel opens UTF-8 CSVs (names with diacritics, etc.) correctly.
  downloadBlob("﻿" + lines.join("\r\n"), "text/csv;charset=utf-8", filename);
}

/**
 * Assignment-wise gradebook export — one row per student, one column per
 * assignment (matches the on-screen gradebook exactly; both are built from
 * the same cell-classification logic in MarksTab.tsx, so they can never
 * disagree). Every cell is a plain string value — never a spreadsheet
 * formula — so this can never produce a #REF! or similar formula error.
 */
export function exportGradebookToExcel(
  headers: string[],
  rows: string[][],
  footerRow: string[] | null,
  filename: string,
  sheetName = "Gradebook"
) {
  const cell = (value: string) => `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
  const headerCells = headers.map(cell).join("");
  const bodyRows = rows.map((row) => `<Row>${row.map(cell).join("")}</Row>`).join("");
  const footerRowXml = footerRow ? `<Row>${footerRow.map(cell).join("")}</Row>` : "";

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${xmlEscape(sheetName)}">
  <Table>
   <Row>${headerCells}</Row>
   ${bodyRows}
   ${footerRowXml}
  </Table>
 </Worksheet>
</Workbook>`;

  downloadBlob(xml, "application/vnd.ms-excel", filename);
}

export function exportGradebookToPdf(
  headers: string[],
  rows: string[][],
  footerRow: string[] | null,
  filename: string,
  title: string
) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 15);

  autoTable(doc, {
    startY: 20,
    head: [headers],
    body: rows,
    foot: footerRow ? [footerRow] : undefined,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [26, 115, 232] },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 40 } },
  });

  doc.save(filename);
}
