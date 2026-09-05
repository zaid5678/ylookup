// Client-side PDF text extraction. Statements arrive as PDFs in practice —
// this reconstructs line-based text from PDF.js's per-item positions so the
// existing label/value line parser in parse.ts can run on it unchanged.
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf/pdf.worker.min.mjs";

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  const lines: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    type Item = { str: string; transform: number[] };
    const items = content.items as Item[];

    // Group text items into lines by their y-coordinate (transform[5]),
    // since PDF.js gives positioned fragments, not pre-joined lines.
    const rows = new Map<number, Item[]>();
    for (const item of items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const bucket = rows.get(y) ?? [];
      bucket.push(item);
      rows.set(y, bucket);
    }

    const sortedYs = Array.from(rows.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const rowItems = rows.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
      lines.push(rowItems.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim());
    }
  }

  return lines.filter(Boolean).join("\n");
}
