import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface MarksExportRow {
  studentName: string;
  rollNumber: string;
  assignmentTitle: string;
  marks: string;
  maxMarks: string;
  status: string;
  timing: string;
  remarks: string;
}

const COLUMNS = [
  "Student Name",
  "Roll Number",
  "Assignment",
  "Marks",
  "Max Marks",
  "Status",
  "Late/On-time",
  "Remarks",
];

function rowToCells(row: MarksExportRow): string[] {
  return [
    row.studentName,
    row.rollNumber,
    row.assignmentTitle,
    row.marks,
    row.maxMarks,
    row.status,
    row.timing,
    row.remarks,
  ];
}

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

/**
 * Excel-compatible export using the SpreadsheetML 2003 XML format — Excel and
 * Google Sheets both open it natively as a single file, no zip/binary work
 * needed, so no extra dependency (and no exposure to SheetJS's unpatched
 * ReDoS/prototype-pollution advisories) is required.
 */
export function exportMarksToExcel(rows: MarksExportRow[], filename: string) {
  const headerCells = COLUMNS.map(
    (c) => `<Cell><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`
  ).join("");

  const bodyRows = rows
    .map((row) => {
      const cells = rowToCells(row)
        .map((c) => `<Cell><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`)
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Marks">
  <Table>
   <Row>${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;

  downloadBlob(xml, "application/vnd.ms-excel", filename);
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

export function exportMarksToPdf(rows: MarksExportRow[], filename: string, title: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 15);

  autoTable(doc, {
    startY: 20,
    head: [COLUMNS],
    body: rows.map(rowToCells),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [26, 115, 232] },
  });

  doc.save(filename);
}
