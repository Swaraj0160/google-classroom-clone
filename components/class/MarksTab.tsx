"use client";

import { useState } from "react";
import { students as initialStudents } from "@/lib/data";
import { Download, Sparkles, Save } from "lucide-react";

interface Row {
  id: string;
  name: string;
  rollNumber: string;
  avatar: string;
  assignment: number;
  quiz: number;
  midterm: number;
  final: number;
}

const seedRows: Row[] = initialStudents.map((s, i) => ({
  id: s.id,
  name: s.name,
  rollNumber: s.rollNumber,
  avatar: s.avatar,
  assignment: 15 + (i % 5),
  quiz: 7 + (i % 3),
  midterm: 20 + (i % 8),
  final: 30 + (i % 15),
}));

export default function MarksTab() {
  const [rows, setRows] = useState<Row[]>(seedRows);
  const [saved, setSaved] = useState(true);

  const updateCell = (id: string, field: keyof Row, value: number) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
    setSaved(false);
  };

  const total = (r: Row) => r.assignment + r.quiz + r.midterm + r.final;

  const exportCSV = () => {
    const header = "Name,Roll Number,Assignment,Quiz,Midterm,Final,Total\n";
    const body = rows
      .map(
        (r) =>
          `${r.name},${r.rollNumber},${r.assignment},${r.quiz},${r.midterm},${r.final},${total(r)}`
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "marks.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink dark:text-white">
            Marks
          </h2>
          <p className="text-xs text-ink-faint">
            {saved ? "All changes saved" : "Unsaved changes"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-ink-soft shadow-soft transition-all duration-200 hover:bg-surface-alt dark:border-white/10 dark:bg-surface-darkAlt dark:text-gray-300"
          >
            <Download size={16} /> Export CSV
          </button>
          <button
            onClick={() => setSaved(true)}
            className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-ink-soft shadow-soft transition-all duration-200 hover:bg-surface-alt dark:border-white/10 dark:bg-surface-darkAlt dark:text-gray-300"
          >
            <Save size={16} /> Save
          </button>
          <button className="flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-purple to-fuchsia-600 px-4 py-2.5 text-sm font-medium text-white shadow-soft transition-all duration-200 hover:shadow-glow active:scale-95">
            <Sparkles size={16} /> Generate Result
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-card dark:border-white/5 dark:bg-surface-darkAlt">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-surface-alt/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint dark:border-white/10 dark:bg-white/5">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3 text-center">Assignment /20</th>
                <th className="px-4 py-3 text-center">Quiz /10</th>
                <th className="px-4 py-3 text-center">Midterm /30</th>
                <th className="px-4 py-3 text-center">Final /40</th>
                <th className="px-4 py-3 text-center">Total /100</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-surface-alt/60 dark:hover:bg-white/5">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.avatar}
                        alt={r.name}
                        className="h-8 w-8 rounded-full"
                      />
                      <div>
                        <p className="font-medium text-ink dark:text-white">{r.name}</p>
                        <p className="text-[11px] text-ink-faint">{r.rollNumber}</p>
                      </div>
                    </div>
                  </td>
                  {(["assignment", "quiz", "midterm", "final"] as const).map(
                    (field) => (
                      <td key={field} className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          value={r[field]}
                          onChange={(e) =>
                            updateCell(r.id, field, Number(e.target.value))
                          }
                          className="w-16 rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-center text-sm outline-none transition-colors focus:border-brand-blue focus:bg-blue-50/50 dark:border-white/10 dark:focus:bg-blue-500/10"
                        />
                      </td>
                    )
                  )}
                  <td className="px-4 py-2.5 text-center">
                    <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-brand-green dark:bg-green-500/10">
                      {total(r)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
