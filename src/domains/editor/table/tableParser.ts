import { TableColumn, TableData, ColumnAlignment } from "./tableTypes";

/**
 * Ekstraksi teks dari struktur AST HAST ReactMarkdown
 */
function extractNodeText(node: any): string {
  if (!node) return "";
  if (node.type === "text") return node.value || "";
  if (Array.isArray(node.children)) {
    return node.children.map(extractNodeText).join("");
  }
  return "";
}

/**
 * Mengekstrak data tabel (TableData) dari HAST AST node (react-markdown / rehype)
 */
export function extractTableDataFromHastNode(node: any): TableData | null {
  if (!node || node.type !== "element" || node.tagName !== "table") {
    return null;
  }

  const getNodeText = (n: any): string => {
    if (!n) return "";
    if (n.type === "text") return n.value ?? "";
    if (Array.isArray(n.children)) {
      return n.children.map(getNodeText).join("");
    }
    return "";
  };

  try {
    const theadNode = node.children?.find(
      (c: any) => c.type === "element" && c.tagName === "thead"
    );
    const tbodyNode = node.children?.find(
      (c: any) => c.type === "element" && c.tagName === "tbody"
    );

    // Cari baris header di thead atau tr pertama
    const headerTr = theadNode?.children?.find(
      (c: any) => c.type === "element" && c.tagName === "tr"
    );

    const thNodes =
      headerTr?.children?.filter(
        (c: any) => c.type === "element" && (c.tagName === "th" || c.tagName === "td")
      ) || [];

    if (thNodes.length === 0) {
      return null;
    }

    const columns: TableColumn[] = thNodes.map((th: any, idx: number) => {
      const rawAlign = th.properties?.align || "";
      let alignment: ColumnAlignment = "default";
      if (rawAlign === "center") alignment = "center";
      else if (rawAlign === "right") alignment = "right";
      else if (rawAlign === "left") alignment = "left";

      return {
        id: `col_${idx}_${Date.now()}`,
        name: getNodeText(th).trim(),
        alignment,
      };
    });

    // Ambil data baris dari tbody
    const rows: string[][] = [];
    const bodyTrs =
      tbodyNode?.children?.filter(
        (c: any) => c.type === "element" && c.tagName === "tr"
      ) || [];

    for (const tr of bodyTrs) {
      const tdNodes =
        tr.children?.filter(
          (c: any) => c.type === "element" && (c.tagName === "td" || c.tagName === "th")
        ) || [];

      const rowCells = columns.map((_, cIdx) => {
        const td = tdNodes[cIdx];
        return td ? getNodeText(td).trim() : "";
      });

      rows.push(rowCells);
    }

    return { columns, rows };
  } catch {
    return null;
  }
}


/**
 * Mengurai string blok Markdown Table menjadi struktur TableData
 */
export function parseMarkdownTable(markdown: string): TableData | null {
  const lines = markdown
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));

  if (lines.length < 2) return null;

  // 1. Ekstrak header
  const headerLine = lines[0];
  const rawHeaders = headerLine
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());

  // 2. Ekstrak delimiter perataan (:---, :---:, ---:)
  const delimiterLine = lines[1];
  const rawDelimiters = delimiterLine
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());

  if (rawHeaders.length === 0 || rawDelimiters.length !== rawHeaders.length) {
    return null;
  }

  const columns: TableColumn[] = rawHeaders.map((header, index) => {
    const delim = rawDelimiters[index] || "";
    let alignment: ColumnAlignment = "default";
    const starts = delim.startsWith(":");
    const ends = delim.endsWith(":");

    if (starts && ends) alignment = "center";
    else if (starts) alignment = "left";
    else if (ends) alignment = "right";

    return {
      id: `col_${index}_${Date.now()}`,
      name: header,
      alignment,
    };
  });

  // 3. Ekstrak baris-baris data
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const rawCells = lines[i]
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());

    const rowCells = columns.map((_, colIdx) => rawCells[colIdx] ?? "");
    rows.push(rowCells);
  }

  return { columns, rows };
}

/**
 * Mengubah kembali TableData menjadi string Markdown Table GFM yang rapi
 */
export function stringifyMarkdownTable(data: TableData): string {
  if (data.columns.length === 0) return "";

  const colWidths = data.columns.map((col, cIdx) => {
    let max = Math.max(col.name.length, 3);
    for (const row of data.rows) {
      if (row[cIdx] && row[cIdx].length > max) {
        max = row[cIdx].length;
      }
    }
    return max;
  });

  const header = `| ${data.columns
    .map((col, i) => col.name.padEnd(colWidths[i], " "))
    .join(" | ")} |`;

  const delimiter = `| ${data.columns
    .map((col, i) => {
      const len = colWidths[i];
      if (col.alignment === "center") return `:${"-".repeat(Math.max(len - 2, 1))}:`;
      if (col.alignment === "right") return `${"-".repeat(Math.max(len - 1, 2))}:`;
      if (col.alignment === "left") return `:${"-".repeat(Math.max(len - 1, 2))}`;
      return "-".repeat(len);
    })
    .join(" | ")} |`;

  const rows = data.rows.map((row) => {
    return `| ${data.columns
      .map((_, cIdx) => {
        const val = row[cIdx] || "";
        return val.padEnd(colWidths[cIdx], " ");
      })
      .join(" | ")} |`;
  });

  return [header, delimiter, ...rows].join("\n");
}

