"use client";

import { useMemo, useRef, useState } from "react";
import { checkIdentity } from "@/lib/identity";
import { extractPdfText } from "@/lib/pdf";
import { parseMultiStatement } from "@/lib/parse";
import { InvestorPair, pairInvestors } from "@/lib/pairing";
import { toMarkdownReport } from "@/lib/report";
import { DEFAULT_TOLERANCE, fmtMoney, reconcile, ReconRow, ToleranceConfig } from "@/lib/reconcile";
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
  const [tolerance, setTolerance] = useState<ToleranceConfig>(DEFAULT_TOLERANCE);
  const [selectedPairKey, setSelectedPairKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const textAreaARef = useRef<HTMLTextAreaElement>(null);
  const textAreaBRef = useRef<HTMLTextAreaElement>(null);

  const pairs = useMemo(() => {
    const a = parseMultiStatement(textA);
    const b = parseMultiStatement(textB);
    return pairInvestors(a, b);
  }, [textA, textB]);

  const selectedPair: InvestorPair =
    pairs.find((p) => p.key === selectedPairKey) ?? pairs[0];

  const result = useMemo(() => {
    if (!selectedPair?.a || !selectedPair?.b) return null;
    const { rows, summary } = reconcile(selectedPair.a, selectedPair.b, tolerance);
    const identityMismatches = checkIdentity(selectedPair.a, selectedPair.b);
    return { rows, summary, identityMismatches };
  }, [selectedPair, tolerance]);

  const needsReview = result?.rows.filter((r) => r.status === "break" || r.status === "missing") ?? [];

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

  function highlightSource(row: ReconRow) {
    const highlight = (ref: React.RefObject<HTMLTextAreaElement | null>, stmt: typeof selectedPair.a) => {
      const raw = stmt?.raw[row.key];
      const el = ref.current;
      if (!raw || !el) return;
      el.focus();
      el.setSelectionRange(raw.start, raw.end);
      const before = el.value.slice(0, raw.start);
      const lineNumber = before.split("\n").length;
      const lineHeight = 18; // matches text-xs leading-relaxed in the textarea below
      el.scrollTop = Math.max(0, (lineNumber - 3) * lineHeight);
    };
    highlight(textAreaARef, selectedPair.a);
    highlight(textAreaBRef, selectedPair.b);
  }

  async function copyReport() {
    if (!result || !selectedPair.a) return;
    const md = toMarkdownReport({
      investorLabel: selectedPair.label,
      fundName: selectedPair.a.fundName ?? selectedPair.b?.fundName,
      asOfDate: selectedPair.a.asOfDate ?? selectedPair.b?.asOfDate,
      rows: result.rows,
      tieOutA: result.summary.tieOutA,
      tieOutB: result.summary.tieOutB,
    });
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
            textareaRef={textAreaARef}
          />
          <StatementInput
            label="Source B"
            hint="e.g. LP's own record / custodian feed"
            value={textB}
            onChange={setTextB}
            onFile={(f) => handleFile(f, "b")}
            loading={loadingB}
            textareaRef={textAreaBRef}
          />
        </div>

        {fileError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {fileError}
          </div>
        )}

        <ToleranceControls tolerance={tolerance} onChange={setTolerance} />

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
            {pairs.length > 1 && (
              <InvestorTabs
                pairs={pairs}
                selectedKey={selectedPair?.key}
                onSelect={setSelectedPairKey}
              />
            )}

            {!selectedPair?.a || !selectedPair?.b ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                {selectedPair?.label ?? "This investor"} was only found in{" "}
                {selectedPair?.a ? "Source A" : "Source B"} — nothing to reconcile against.
              </div>
            ) : (
              result && (
                <>
                  {result.identityMismatches.length > 0 && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4">
                      <h2 className="text-sm font-semibold text-amber-900">
                        Check you&apos;re comparing the right documents
                      </h2>
                      <ul className="mt-2 space-y-1 text-sm text-amber-800">
                        {result.identityMismatches.map((m) => (
                          <li key={m.field}>
                            <span className="font-medium">{m.field}:</span> Source A says &ldquo;{m.a}
                            &rdquo;, Source B says &ldquo;{m.b}&rdquo;.
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <SummaryBar summary={result.summary} totalRows={result.rows.length} />

                  {needsReview.length > 0 && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-5 py-4">
                      <h2 className="text-sm font-semibold text-rose-800">
                        {needsReview.length} item{needsReview.length > 1 ? "s" : ""} need analyst
                        review
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

                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-zinc-700">
                      Line items — click a row to highlight it in the source text
                    </h2>
                    <button
                      onClick={copyReport}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      {copied ? "Copied ✓" : "Copy report as Markdown"}
                    </button>
                  </div>

                  <ReconTable rows={result.rows} onRowClick={highlightSource} />

                  {(result.summary.tieOutA !== null || result.summary.tieOutB !== null) && (
                    <TieOutCheck tieOutA={result.summary.tieOutA} tieOutB={result.summary.tieOutB} />
                  )}

                  {(selectedPair.a.unmatchedLines.length > 0 ||
                    selectedPair.b.unmatchedLines.length > 0) && (
                    <UnmatchedLines a={selectedPair.a.unmatchedLines} b={selectedPair.b.unmatchedLines} />
                  )}
                </>
              )
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
  textareaRef,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onFile: (file: File) => void;
  loading: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
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
          ref={textareaRef}
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

function ToleranceControls({
  tolerance,
  onChange,
}: {
  tolerance: ToleranceConfig;
  onChange: (t: ToleranceConfig) => void;
}) {
  return (
    <details className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-zinc-600">
        Tolerance settings ({fmtMoney(tolerance.absTolerance)} / {(tolerance.roundingPct * 100).toFixed(2)}%)
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Exact-match tolerance ($)</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={tolerance.absTolerance}
            onChange={(e) => onChange({ ...tolerance, absTolerance: Number(e.target.value) || 0 })}
            className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Rounding threshold (%)</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={tolerance.roundingPct * 100}
            onChange={(e) =>
              onChange({ ...tolerance, roundingPct: (Number(e.target.value) || 0) / 100 })
            }
            className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
      </div>
    </details>
  );
}

function InvestorTabs({
  pairs,
  selectedKey,
  onSelect,
}: {
  pairs: InvestorPair[];
  selectedKey?: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {pairs.map((p) => {
        const isSelected = p.key === selectedKey || (!selectedKey && p === pairs[0]);
        const complete = p.a && p.b;
        return (
          <button
            key={p.key}
            onClick={() => onSelect(p.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              isSelected
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {p.label}
            {!complete && <span className="ml-1.5 text-amber-500">●</span>}
          </button>
        );
      })}
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

function ReconTable({ rows, onRowClick }: { rows: ReconRow[]; onRowClick: (row: ReconRow) => void }) {
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
              <tr
                key={r.key}
                onClick={() => onRowClick(r)}
                className="cursor-pointer border-b border-zinc-100 last:border-0 align-top hover:bg-zinc-50"
              >
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
