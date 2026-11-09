export type ColumnAlignment = "left" | "center" | "right" | "default";

export interface TableColumn {
  id: string;
  name: string;
  alignment: ColumnAlignment;
  width?: number; // Lebar kolom dalam pixel (hasil drag resize)
  wrap?: boolean;  // Status pembungkusan teks (wrap text vs unwrap)
}

export interface TableData {
  columns: TableColumn[];
  rows: string[][];
  pinnedColIndex?: number | null; // Kolom yang di-freeze di sisi kiri
  rowHeights?: number[];           // Tinggi baris hasil drag resize
}

export interface TableCellCoord {
  rowIndex: number;
  colIndex: number;
}