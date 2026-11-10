import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus,
  ArrowUpAZ,
  ArrowDownZA,
  ArrowLeft,
  ArrowRight,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Trash2,
  Pin,
  WrapText,
  X,
} from "lucide-react";
import { cn } from "@/shared/lib";
import { TableData, TableColumn } from "@/domains/editor/table/tableTypes";
import { parseMarkdownTable, stringifyMarkdownTable } from "@/domains/editor/table/tableParser";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

interface InteractiveTableProps {
  initialMarkdown?: string;
  tableData?: TableData;
  readOnly?: boolean;
  onChange?: (newMarkdown: string) => void;
  className?: string;
}

export const InteractiveTable: React.FC<InteractiveTableProps> = ({
  initialMarkdown = "",
  tableData: propTableData,
  readOnly = false,
  onChange,
  className,
}) => {
  const [data, setData] = useState<TableData>(() => {
    if (propTableData) return propTableData;
    const parsed = parseMarkdownTable(initialMarkdown);
    return (
      parsed || {
        columns: [
          { id: "col_1", name: "Header 1", alignment: "left" },
          { id: "col_2", name: "Header 2", alignment: "left" },
        ],
        rows: [["", ""]],
      }
    );
  });

  const [colWidths, setColWidths] = useState<number[]>(() =>
    data.columns.map((c) => c.width || 140)
  );
  const [rowHeights, setRowHeights] = useState<number[]>(() =>
    data.rows.map(() => 34)
  );
  const [pinnedColIndex, setPinnedColIndex] = useState<number | null>(null);
  const [wrapStates, setWrapStates] = useState<boolean[]>(() =>
    data.columns.map((c) => Boolean(c.wrap))
  );

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propTableData) {
      setData(propTableData);
      setColWidths(propTableData.columns.map((c) => c.width || 140));
      setRowHeights(propTableData.rows.map(() => 34));
      setWrapStates(propTableData.columns.map((c) => Boolean(c.wrap)));
    }
  }, [propTableData]);

  const emitChange = useCallback(
    (nextData: TableData) => {
      setData(nextData);
      const nextMd = stringifyMarkdownTable(nextData);
      onChange?.(nextMd);
    },
    [onChange]
  );

  // --- Operasi Kolom ---
  const handleSort = (colIndex: number, direction: "asc" | "desc") => {
    const sortedRows = [...data.rows].sort((a, b) => {
      const valA = a[colIndex] || "";
      const valB = b[colIndex] || "";
      return direction === "asc"
        ? valA.localeCompare(valB, undefined, { numeric: true })
        : valB.localeCompare(valA, undefined, { numeric: true });
    });
    emitChange({ ...data, rows: sortedRows });
  };

  const togglePin = (colIndex: number) => {
    setPinnedColIndex((prev) => (prev === colIndex ? null : colIndex));
  };

  const toggleWrap = (colIndex: number) => {
    setWrapStates((prev) => {
      const next = [...prev];
      next[colIndex] = !next[colIndex];
      return next;
    });
  };

  const handleAddColumn = (targetIndex: number) => {
    if (readOnly) return;
    const colNum = data.columns.length + 1;
    const newCol: TableColumn = {
      id: `col_${Date.now()}`,
      name: `Kolom ${colNum}`,
      alignment: "left",
    };
    const nextCols = [...data.columns];
    nextCols.splice(targetIndex, 0, newCol);

    const nextRows = data.rows.map((row) => {
      const cells = [...row];
      cells.splice(targetIndex, 0, "");
      return cells;
    });

    setColWidths((prev) => {
      const next = [...prev];
      next.splice(targetIndex, 0, 140);
      return next;
    });
    setWrapStates((prev) => {
      const next = [...prev];
      next.splice(targetIndex, 0, false);
      return next;
    });

    emitChange({ ...data, columns: nextCols, rows: nextRows });
  };

  const handleDeleteColumn = (colIndex: number) => {
    if (readOnly || data.columns.length <= 1) return;
    const nextCols = data.columns.filter((_, i) => i !== colIndex);
    const nextRows = data.rows.map((row) => row.filter((_, i) => i !== colIndex));

    setColWidths((prev) => prev.filter((_, i) => i !== colIndex));
    setWrapStates((prev) => prev.filter((_, i) => i !== colIndex));
    if (pinnedColIndex === colIndex) setPinnedColIndex(null);

    emitChange({ ...data, columns: nextCols, rows: nextRows });
  };

  const handleAlign = (colIndex: number, alignment: "left" | "center" | "right") => {
    if (readOnly) return;
    const nextCols = data.columns.map((c, i) => (i === colIndex ? { ...c, alignment } : c));
    emitChange({ ...data, columns: nextCols });
  };

  const handleDuplicateColumn = (colIndex: number) => {
    if (readOnly) return;
    const sourceCol = data.columns[colIndex];
    const newCol: TableColumn = {
      ...sourceCol,
      id: `col_${Date.now()}`,
      name: `${sourceCol.name} (Copy)`,
    };
    const nextCols = [...data.columns];
    nextCols.splice(colIndex + 1, 0, newCol);

    const nextRows = data.rows.map((row) => {
      const cells = [...row];
      cells.splice(colIndex + 1, 0, row[colIndex] || "");
      return cells;
    });

    setColWidths((prev) => {
      const next = [...prev];
      next.splice(colIndex + 1, 0, prev[colIndex] || 140);
      return next;
    });
    setWrapStates((prev) => {
      const next = [...prev];
      next.splice(colIndex + 1, 0, prev[colIndex]);
      return next;
    });

    emitChange({ ...data, columns: nextCols, rows: nextRows });
  };

  // --- Operasi Baris ---
  const handleAddRow = () => {
    if (readOnly) return;
    const newRow = data.columns.map(() => "");
    setRowHeights((prev) => [...prev, 34]);
    emitChange({ ...data, rows: [...data.rows, newRow] });
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (readOnly) return;
    const nextRows = data.rows.filter((_, i) => i !== rowIndex);
    setRowHeights((prev) => prev.filter((_, i) => i !== rowIndex));
    emitChange({ ...data, rows: nextRows });
  };

  // --- Drag to Resize Kolom (Berfungsi di Kedua Mode) ---
  const handleStartColResize = (cIdx: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[cIdx] || 140;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const delta = moveEvt.clientX - startX;
      const newWidth = Math.max(70, startWidth + delta);
      setColWidths((prev) => {
        const next = [...prev];
        next[cIdx] = newWidth;
        return next;
      });
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // --- Drag to Resize Baris (Berfungsi di Kedua Mode) ---
  const handleStartRowResize = (rIdx: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = rowHeights[rIdx] || 34;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const delta = moveEvt.clientY - startY;
      const newHeight = Math.max(26, startHeight + delta);
      setRowHeights((prev) => {
        const next = [...prev];
        next[rIdx] = newHeight;
        return next;
      });
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div
      ref={containerRef}
      className={cn("my-3 w-full not-prose select-none relative group/table", className)}
    >
      {/* 2. WRAPPER SCROLL HORIZONTAL (Mendukung Ratusan Kolom) */}
      <div className="w-full max-w-full overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
        <table className="border-collapse border border-border/25 text-xs select-text table-fixed min-w-max">
          <colgroup>
            {data.columns.map((_, cIdx) => (
              <col key={cIdx} style={{ width: `${colWidths[cIdx] || 140}px` }} />
            ))}
            {!readOnly && <col style={{ width: "32px" }} />}
          </colgroup>

          {/* 3. THEAD DENGAN GAGANG PENARIK DAN COMPACT MENU */}
          <thead className="bg-muted/20 border-b border-border/40 font-semibold text-foreground select-none">
            <tr>
              {data.columns.map((col, cIdx) => {
                const isPinned = pinnedColIndex === cIdx;
                const isWrapped = wrapStates[cIdx];

                return (
                  <th
                    key={col.id || cIdx}
                    className={cn(
                      "px-2 py-1.5 border-r border-border/25 relative group/th text-left font-medium",
                      col.alignment === "center" && "text-center",
                      col.alignment === "right" && "text-right",
                      isPinned &&
                        "sticky left-0 z-20 bg-background/95 backdrop-blur shadow-[2px_0_4px_rgba(0,0,0,0.1)]"
                    )}
                  >
                    {/* Gagang Kolom (:::) Muncul di Atas Header Kolom Saat Hover */}
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover/th:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="px-1 py-0.2 rounded bg-muted/90 text-muted-foreground hover:bg-primary hover:text-primary-foreground text-[9px] shadow-sm cursor-pointer"
                            title="Opsi Kolom"
                          >
                            :::
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-48 p-1 text-[11px] backdrop-blur-md">
                          <DropdownMenuItem
                            className="py-1 px-2 text-[11px] gap-2 cursor-pointer"
                            onClick={() => handleSort(cIdx, "asc")}
                          >
                            <ArrowUpAZ className="w-3.5 h-3.5 opacity-70" />
                            <span>Sort by column (A to Z)</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="py-1 px-2 text-[11px] gap-2 cursor-pointer"
                            onClick={() => handleSort(cIdx, "desc")}
                          >
                            <ArrowDownZA className="w-3.5 h-3.5 opacity-70" />
                            <span>Sort by column (Z to A)</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator className="my-0.5" />

                          <DropdownMenuItem
                            className="py-1 px-2 text-[11px] gap-2 cursor-pointer"
                            onClick={() => togglePin(cIdx)}
                          >
                            <Pin className="w-3.5 h-3.5 opacity-70" />
                            <span>{isPinned ? "Unfreeze column" : "Freeze column (pin to start)"}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="py-1 px-2 text-[11px] gap-2 cursor-pointer"
                            onClick={() => toggleWrap(cIdx)}
                          >
                            <WrapText className="w-3.5 h-3.5 opacity-70" />
                            <span>{isWrapped ? "Unwrap text (single line)" : "Wrap text (multi-line)"}</span>
                          </DropdownMenuItem>

                          {/* Opsi Tambahan untuk Edit Mode */}
                          {!readOnly && (
                            <>
                              <DropdownMenuSeparator className="my-0.5" />
                              <DropdownMenuItem
                                className="py-1 px-2 text-[11px] gap-2 cursor-pointer"
                                onClick={() => handleAddColumn(cIdx)}
                              >
                                <ArrowLeft className="w-3.5 h-3.5 opacity-70" />
                                <span>Add column to left</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="py-1 px-2 text-[11px] gap-2 cursor-pointer"
                                onClick={() => handleAddColumn(cIdx + 1)}
                              >
                                <ArrowRight className="w-3.5 h-3.5 opacity-70" />
                                <span>Add column to right</span>
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="my-0.5" />
                              <DropdownMenuItem
                                className="py-1 px-2 text-[11px] gap-2 cursor-pointer"
                                onClick={() => handleAlign(cIdx, "left")}
                              >
                                <AlignLeft className="w-3.5 h-3.5 opacity-70" />
                                <span>Align left</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="py-1 px-2 text-[11px] gap-2 cursor-pointer"
                                onClick={() => handleAlign(cIdx, "center")}
                              >
                                <AlignCenter className="w-3.5 h-3.5 opacity-70" />
                                <span>Align center</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="py-1 px-2 text-[11px] gap-2 cursor-pointer"
                                onClick={() => handleAlign(cIdx, "right")}
                              >
                                <AlignRight className="w-3.5 h-3.5 opacity-70" />
                                <span>Align right</span>
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="my-0.5" />
                              <DropdownMenuItem
                                className="py-1 px-2 text-[11px] gap-2 cursor-pointer"
                                onClick={() => handleDuplicateColumn(cIdx)}
                              >
                                <Copy className="w-3.5 h-3.5 opacity-70" />
                                <span>Duplicate column</span>
                              </DropdownMenuItem>

                              {data.columns.length > 1 && (
                                <DropdownMenuItem
                                  className="py-1 px-2 text-[11px] gap-2 text-destructive focus:text-destructive cursor-pointer"
                                  onClick={() => handleDeleteColumn(cIdx)}
                                >
                                  <Trash2 className="w-3.5 h-3.5 opacity-70" />
                                  <span>Delete column</span>
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Judul Kolom (Input saat Edit, Teks saat Read) */}
                    {readOnly ? (
                      <div className="px-1 py-0.5 truncate text-foreground select-text">{col.name}</div>
                    ) : (
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          const nextCols = data.columns.map((c, i) =>
                            i === cIdx ? { ...c, name: val } : c
                          );
                          emitChange({ ...data, columns: nextCols });
                        }}
                        className="w-full bg-transparent border-none font-semibold text-foreground focus:outline-none focus:bg-muted/40 rounded px-1 py-0.5 truncate"
                      />
                    )}

                    {/* Resizer Kolom (Drag to Resize) */}
                    <div
                      onPointerDown={(e) => handleStartColResize(cIdx, e)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 transition-colors z-10"
                    />
                  </th>
                );
              })}

              {/* Tombol Tambah Kolom (+) di Kanan Header */}
              {!readOnly && (
                <th className="w-8 px-1 py-1 text-center align-middle border-l border-border/20">
                  <button
                    type="button"
                    onClick={() => handleAddColumn(data.columns.length)}
                    className="opacity-40 hover:opacity-100 text-muted-foreground hover:text-foreground text-xs font-bold transition-opacity px-1 rounded hover:bg-muted/40 cursor-pointer"
                    title="Tambah Kolom ke Kanan"
                  >
                    <Plus className="w-3.5 h-3.5 mx-auto" />
                  </button>
                </th>
              )}
            </tr>
          </thead>

          {/* 4. TBODY */}
          <tbody className="divide-y divide-border/20">
            {data.rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                style={{ height: `${rowHeights[rIdx] || 34}px` }}
                className="even:bg-muted/5 hover:bg-muted/15 transition-colors relative group/row"
              >
                {row.map((cellVal, cIdx) => {
                  const isPinned = pinnedColIndex === cIdx;
                  const isWrapped = wrapStates[cIdx];
                  const col = data.columns[cIdx];

                  return (
                    <td
                      key={cIdx}
                      className={cn(
                        "px-2 py-1 border-r border-border/20 align-top relative",
                        col?.alignment === "center" && "text-center",
                        col?.alignment === "right" && "text-right",
                        isPinned &&
                          "sticky left-0 z-10 bg-background/95 backdrop-blur shadow-[2px_0_4px_rgba(0,0,0,0.08)]"
                      )}
                    >
                      {readOnly ? (
                        <div
                          className={cn(
                            "px-1 py-0.5 text-xs text-foreground select-text",
                            isWrapped ? "whitespace-normal break-words" : "whitespace-nowrap truncate"
                          )}
                        >
                          {cellVal || "\u00A0"}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={cellVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            const nextRows = data.rows.map((r, i) =>
                              i === rIdx ? r.map((c, j) => (j === cIdx ? val : c)) : r
                            );
                            emitChange({ ...data, rows: nextRows });
                          }}
                          className={cn(
                            "w-full bg-transparent border-none text-foreground focus:outline-none focus:bg-muted/40 rounded px-1 py-0.5 text-xs",
                            isWrapped ? "whitespace-normal" : "whitespace-nowrap truncate"
                          )}
                        />
                      )}
                    </td>
                  );
                })}

                {/* Tombol Hapus Baris (×) di Sisi Kanan Baris */}
                {!readOnly && (
                  <td className="w-8 px-1 py-1 text-center align-middle border-l border-border/20">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(rIdx)}
                      className="opacity-0 group-hover/row:opacity-100 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded px-1 text-xs transition-opacity cursor-pointer"
                      title="Hapus Baris Ini"
                    >
                      <X className="w-3.5 h-3.5 mx-auto" />
                    </button>
                  </td>
                )}

                {/* Resizer Baris (Drag to Resize) */}
                <div
                  onPointerDown={(e) => handleStartRowResize(rIdx, e)}
                  className="absolute left-0 right-0 bottom-0 h-1.5 cursor-row-resize hover:bg-primary/50 transition-colors z-10"
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 5. TOMBOL TAMBAH BARIS (+ Tambah Baris) DI BAWAH KIRI */}
      {!readOnly && (
        <div className="pt-1 text-left">
          <button
            type="button"
            onClick={handleAddRow}
            className="text-[11px] text-muted-foreground/60 hover:text-foreground font-medium px-1.5 py-0.5 rounded hover:bg-muted/30 transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3 opacity-70" />
            <span>Tambah Baris</span>
          </button>
        </div>
      )}
    </div>
  );
};