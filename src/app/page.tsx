"use client";

import { useMemo, useRef, useState } from "react";
import { parseStatement } from "@/lib/parse";
import { reconcile, fmtMoney, ReconRow } from "@/lib/reconcile";
import { checkIdentity } from "@/lib/identity";
import { extractPdfText } from "@/lib/pdf";
import { SAMPLE_A, SAMPLE_B } from "@/lib/samples";

const STATUS_STYLE: Record<ReconRow["status"], { bg: string; text: string; label: string }> = {
  match: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Match" },
  rounding: { bg: "bg-sky-50", text: "text-sky-700", label: "Rounding" },
  explained: { bg: "bg-amber-50", text: "text-amber-800", label: "Reclassified" },
  break: { bg: "bg-rose-50", text: "text-rose-700", label: "Break" },
  missing: { bg: "bg-zinc-50", text: "text-zinc-600", label: "Missing" },
};

export default function Home() {
  const [textA, setTextA] = useState(SAMPLE_A);
  const [textB, setTextB] = useState(SAMPLE_B);
  const [ran, setRan] = useState(false);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const result = useMemo(() => {
    const a = parseStatement(textA);
    const b = parseStatement(textB);
    const { rows, summary } = reconcile(a, b);
    const identityMismatches = checkIdentity(a, b);
    return { a, b, rows, summary, identityMismatches };
  }, [textA, textB]);

  const needsReview = result.rows.filter((r) => r.status === "break" || r.status === "missing");

  async function handleFile(file: File, which: "a" | "b") {
    setFileError(null);
    const setLoading = which === "a" ? setLoadingA : setLoadingB;
    const setText = which === "a" ? setTextA : setTextB;
    setLoading(true);
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const text = await extractPdfText(file);
        setText(text);
      } else {
        setText(await file.text());
      }
    } catch (err) {
      setFileError(`Couldn't read ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <h1 className="text-xl font-semibold tracking-tight">Capital Account Reconciler</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Paste a fund admin capital account statement against a second source (LP record,
            custodian, prior-quarter roll-forward) and get a line-by-line reconciliation — with a
            best guess at *why* each variance exists, not just that it exists.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <StatementInput
            label="Source A"
            hint="e.g. Fund administrator statement"
            value={textA}
            onChange={setTextA}
            onFile={(f) => handleFile(f, "a")}
            loading={loadingA}
          />
          <StatementInput
            label="Source B"
            hint="e.g. LP's own record / custodian feed"
            value={textB}
            onChange={setTextB}
            onFile={(f) => handleFile(f, "b")}
            loading={loadingB}
          />
        </div>

        {fileError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {fileError}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => setRan(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Reconcile
          </button>
          <button
            onClick={() => {
              setTextA(SAMPLE_A);
              setTextB(SAMPLE_B);
              setRan(true);
            }}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-white transition-colors"
          >
            Load sample pair
          </button>
          <span className="text-xs text-zinc-400">
            Everything runs client-side — no document data leaves the browser.
          </span>
        </div>

        {ran && (
          <>
            {result.identityMismatches.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4">
                <h2 className="text-sm font-semibold text-amber-900">
                  Check you're comparing the right documents
                </h2>
                <ul className="mt-2 space-y-1 text-sm text-amber-800">
                  {result.identityMismatches.map((m) => (
                    <li key={m.field}>
                      <span className="font-medium">{m.field}:</span> Source A says &ldquo;{m.a}&rdquo;, Source B
                      says &ldquo;{m.b}&rdquo;.
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <SummaryBar summary={result.summary} totalRows={result.rows.length} />

            {needsReview.length > 0 && (
              <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-5 py-4">
                <h2 className="text-sm font-semibold text-rose-800">
                  {needsReview.length} item{needsReview.length > 1 ? "s" : ""} need analyst review
                </h2>
                <ul className="mt-2 space-y-1 text-sm text-rose-700">
                  {needsReview.map((r) => (
                    <li key={r.key}>
                      <span className="font-medium">{r.label}:</span> {r.explanation}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ReconTable rows={result.rows} />

            {(result.summary.tieOutA !== null || result.summary.tieOutB !== null) && (
              <TieOutCheck
                tieOutA={result.summary.tieOutA}
                tieOutB={result.summary.tieOutB}
              />
            )}

            {(result.a.unmatchedLines.length > 0 || result.b.unmatchedLines.length > 0) && (
              <UnmatchedLines a={result.a.unmatchedLines} b={result.b.unmatchedLines} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatementInput({
  label,
  hint,
  value,
  onChange,
  onFile,
  loading,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onFile: (file: File) => void;
  loading: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-zinc-400">{hint}</span>
      </div>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={16}
          spellCheck={false}
          className="w-full resize-none rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-800 focus:border-zinc-400 focus:outline-none"
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-white/70 text-xs font-medium text-zinc-500">
            Extracting text…
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Upload PDF or .txt
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function SummaryBar({
  summary,
  totalRows,
}: {
  summary: ReturnType<typeof reconcile>["summary"];
  totalRows: number;
}) {
  const items = [
    { label: "Matched", value: summary.matches, color: "text-emerald-700" },
    { label: "Rounding", value: summary.rounding, color: "text-sky-700" },
    { label: "Reclassified", value: summary.explained, color: "text-amber-800" },
    { label: "Breaks", value: summary.breaks, color: "text-rose-700" },
    { label: "Missing", value: summary.missing, color: "text-zinc-600" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <div className={`text-2xl font-semibold ${item.color}`}>{item.value}</div>
          <div className="text-xs text-zinc-500">
            {item.label} · of {totalRows}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReconTable({ rows }: { rows: ReconRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-3 font-medium">Line item</th>
            <th className="px-4 py-3 font-medium text-right">Source A</th>
            <th className="px-4 py-3 font-medium text-right">Source B</th>
            <th className="px-4 py-3 font-medium text-right">Variance</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Explanation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const style = STATUS_STYLE[r.status];
            return (
              <tr key={r.key} className="border-b border-zinc-100 last:border-0 align-top">
                <td className="px-4 py-3 font-medium text-zinc-800 whitespace-nowrap">{r.label}</td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                  {r.a !== undefined ? fmtMoney(r.a) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                  {r.b !== undefined ? fmtMoney(r.b) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                  {r.diff !== undefined ? fmtMoney(r.diff) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600 max-w-sm">{r.explanation}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TieOutCheck({ tieOutA, tieOutB }: { tieOutA: number | null; tieOutB: number | null }) {
  const check = (v: number | null, label: string) => {
    if (v === null) return null;
    const ok = Math.abs(v) <= 0.01;
    return (
      <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-3">
        <span className="text-sm text-zinc-700">
          {label} internal roll-forward (beginning + activity = ending)
        </span>
        <span className={`text-sm font-medium ${ok ? "text-emerald-700" : "text-rose-700"}`}>
          {ok ? "Ties out" : `Off by ${fmtMoney(v)}`}
        </span>
      </div>
    );
  };
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-700">Internal consistency check</h2>
      {check(tieOutA, "Source A")}
      {check(tieOutB, "Source B")}
    </div>
  );
}

function UnmatchedLines({ a, b }: { a: string[]; b: string[] }) {
  if (a.length === 0 && b.length === 0) return null;
  return (
    <details className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
      <summary className="cursor-pointer font-medium text-zinc-600">
        Lines not recognized as a known field
      </summary>
      <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-zinc-400">Source A</div>
          <ul className="space-y-0.5 font-mono text-xs">
            {a.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-zinc-400">Source B</div>
          <ul className="space-y-0.5 font-mono text-xs">
            {b.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
