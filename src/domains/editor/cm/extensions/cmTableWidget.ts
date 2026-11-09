import { WidgetType, EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, RangeSetBuilder, EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { parseMarkdownTable, stringifyMarkdownTable } from "@/domains/editor/table/tableParser";
import { TableData, TableColumn } from "@/domains/editor/table/tableTypes";

// Cache tata letak tabel (lebar kolom, tinggi baris, wrap, pinned) agar persisten saat re-render
const tableLayoutCache = new Map<
  string,
  {
    colWidths: number[];
    rowHeights: number[];
    pinnedColIndex: number | null;
    wrapStates: boolean[];
  }
>();

class ObsidianTableWidget extends WidgetType {
  constructor(
    readonly rawMarkdown: string,
    readonly from: number,
    readonly to: number
  ) {
    super();
  }

  eq(other: ObsidianTableWidget) {
    return other.rawMarkdown === this.rawMarkdown && other.from === this.from && other.to === this.to;
  }

  // Memberikan estimasi tinggi ke mesin koordinat CodeMirror untuk mencegah chevron desinkronisasi
  get estimatedHeight(): number {
    const lineCount = (this.rawMarkdown.match(/\n/g) || []).length + 1;
    return 60 + lineCount * 36;
  }

  toDOM(view: EditorView): HTMLElement {
    const tableData = parseMarkdownTable(this.rawMarkdown);

    // Kontainer utama: DILARANG menggunakan vertical margin (my-*). Gunakan padding vertikal (py-2).
    // contain: inline-size mencegah tabel melebarkan lebar .cm-content / .cm-scroller editor
    const container = document.createElement("div");
    container.className = "cm-table-widget-container py-2 w-full max-w-full not-prose select-none relative group/table box-border";
    container.style.width = "100%";
    container.style.maxWidth = "100%";
    container.style.boxSizing = "border-box";
    container.style.contain = "inline-size";

    if (!tableData || tableData.columns.length === 0) {
      container.textContent = this.rawMarkdown;
      return container;
    }

    const tableKey = `tbl_${tableData.columns.map((c) => c.name).join("_")}`;
    let layout = tableLayoutCache.get(tableKey);
    if (!layout || layout.colWidths.length !== tableData.columns.length) {
      layout = {
        colWidths: tableData.columns.map((c) => c.width || 140),
        rowHeights: tableData.rows.map(() => 34),
        pinnedColIndex: null,
        wrapStates: tableData.columns.map((c) => Boolean(c.wrap)),
      };
      tableLayoutCache.set(tableKey, layout);
    }

    // Resolusi posisi dokumen secara dinamis dari syntax tree untuk mencegah offset rusak
    const updateDoc = (newData: TableData) => {
      const newMd = stringifyMarkdownTable(newData);
      try {
        const pos = view.posAtDOM(container);
        const tree = syntaxTree(view.state);
        let tableNode = tree.resolveInner(pos, 1);
        while (tableNode && tableNode.name !== "Table" && tableNode.parent) {
          tableNode = tableNode.parent;
        }

        if (tableNode && tableNode.name === "Table") {
          view.dispatch({
            changes: { from: tableNode.from, to: tableNode.to, insert: newMd },
          });
          requestAnimationFrame(() => view.requestMeasure());
          return;
        }
      } catch {
        // Fallback aman
      }

      view.dispatch({
        changes: { from: this.from, to: this.to, insert: newMd },
      });
      requestAnimationFrame(() => view.requestMeasure());
    };

    // --- POPUP MENU KONTEKS (SUPER COMPACT & HEMAT SCREEN) ---
    let activeMenu: HTMLElement | null = null;
    const closeAnyMenu = () => {
      if (activeMenu) {
        activeMenu.remove();
        activeMenu = null;
      }
    };

    const showCompactMenu = (anchorEl: HTMLElement, items: { label: string; icon: string; onClick: () => void; isDestructive?: boolean; isSep?: boolean }[]) => {
      closeAnyMenu();
      const rect = anchorEl.getBoundingClientRect();
      const menu = document.createElement("div");
      menu.className = "fixed z-50 w-48 p-1 bg-popover text-popover-foreground border border-border/80 rounded-md shadow-lg text-[11px] flex flex-col backdrop-blur-md";
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.left = `${Math.min(window.innerWidth - 200, Math.max(8, rect.left - 20))}px`;

      items.forEach((item) => {
        if (item.isSep) {
          const sep = document.createElement("div");
          sep.className = "h-px bg-border/40 my-0.5";
          menu.appendChild(sep);
          return;
        }

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `flex items-center gap-2 px-2 py-1 text-left w-full rounded hover:bg-muted/80 transition-colors cursor-pointer ${
          item.isDestructive ? "text-destructive hover:bg-destructive/10" : ""
        }`;
        btn.innerHTML = `<span class="opacity-70 text-xs w-3.5 text-center">${item.icon}</span><span class="truncate">${item.label}</span>`;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          closeAnyMenu();
          item.onClick();
        });
        menu.appendChild(btn);
      });

      document.body.appendChild(menu);
      activeMenu = menu;

      const handleOutside = (e: MouseEvent) => {
        if (!menu.contains(e.target as Node)) {
          closeAnyMenu();
          document.removeEventListener("pointerdown", handleOutside);
        }
      };
      setTimeout(() => document.addEventListener("pointerdown", handleOutside), 10);
    };

    // 1. GAGANG BLOK UTAMA (::: di Sudut Kiri Atas Tabel)
    const blockHeader = document.createElement("div");
    blockHeader.className = "flex items-center gap-1.5 pb-1 px-0.5 opacity-0 group-hover/table:opacity-100 transition-opacity";

    const blockGrip = document.createElement("button");
    blockGrip.type = "button";
    blockGrip.title = "Opsi Tabel (Hapus, Duplikat, Salin)";
    blockGrip.className = "text-[10px] text-muted-foreground/60 hover:text-foreground font-mono px-1.5 py-0.5 rounded hover:bg-muted/40 cursor-pointer flex items-center gap-1";
    blockGrip.innerHTML = `<span>:::</span><span class="text-[9px] uppercase tracking-wider font-sans opacity-70">Tabel</span>`;
    blockGrip.addEventListener("click", (e) => {
      e.stopPropagation();
      showCompactMenu(blockGrip, [
        {
          label: "Salin Markdown Tabel",
          icon: "📋",
          onClick: () => navigator.clipboard?.writeText(this.rawMarkdown),
        },
        {
          label: "Duplikat Tabel",
          icon: "❐",
          onClick: () => {
            const nextMd = `${this.rawMarkdown}\n\n${this.rawMarkdown}`;
            updateDoc(tableData);
            try {
              const pos = view.posAtDOM(container);
              view.dispatch({ changes: { from: pos, insert: `\n\n${this.rawMarkdown}` } });
            } catch {}
          },
        },
        { isSep: true, label: "", icon: "", onClick: () => {} },
        {
          label: "Hapus Seluruh Tabel",
          icon: "🗑",
          isDestructive: true,
          onClick: () => {
            try {
              const pos = view.posAtDOM(container);
              const tree = syntaxTree(view.state);
              let tableNode = tree.resolveInner(pos, 1);
              while (tableNode && tableNode.name !== "Table" && tableNode.parent) {
                tableNode = tableNode.parent;
              }
              if (tableNode) {
                view.dispatch({ changes: { from: tableNode.from, to: tableNode.to, insert: "" } });
                requestAnimationFrame(() => view.requestMeasure());
                return;
              }
            } catch {}
            view.dispatch({ changes: { from: this.from, to: this.to, insert: "" } });
            requestAnimationFrame(() => view.requestMeasure());
          },
        },
      ]);
    });
    blockHeader.appendChild(blockGrip);
    container.appendChild(blockHeader);

    // 2. WRAPPER SCROLL HORIZONTAL
    const scrollWrapper = document.createElement("div");
    scrollWrapper.className = "w-full max-w-full overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 box-border";
    scrollWrapper.style.width = "100%";
    scrollWrapper.style.maxWidth = "100%";
    scrollWrapper.style.overflowX = "auto";
    scrollWrapper.style.overscrollBehaviorX = "contain";

    const table = document.createElement("table");
    table.className = "border-collapse border border-border/25 text-xs select-text table-fixed min-w-max";

    // Colgroup
    const colgroup = document.createElement("colgroup");
    tableData.columns.forEach((_, cIdx) => {
      const colEl = document.createElement("col");
      colEl.style.width = `${layout!.colWidths[cIdx] || 140}px`;
      colgroup.appendChild(colEl);
    });
    const addColCol = document.createElement("col");
    addColCol.style.width = "32px";
    colgroup.appendChild(addColCol);
    table.appendChild(colgroup);

    // 3. THEAD
    const thead = document.createElement("thead");
    thead.className = "bg-muted/20 border-b border-border/40 font-semibold text-foreground select-none";
    const headerRow = document.createElement("tr");

    // Fungsi utilitas untuk toggle visual wrap seketika di DOM
    const applyColWrap = (targetColIdx: number, isWrapped: boolean) => {
      const allRows = tbody.querySelectorAll("tr");
      allRows.forEach((tr) => {
        const td = tr.children[targetColIdx];
        const editor = td?.querySelector<HTMLElement>(".cm-table-cell-editor");
        if (editor) {
          if (isWrapped) {
            editor.classList.remove("whitespace-nowrap", "truncate", "overflow-hidden");
            editor.classList.add("whitespace-normal", "break-words", "leading-relaxed");
          } else {
            editor.classList.remove("whitespace-normal", "break-words", "leading-relaxed");
            editor.classList.add("whitespace-nowrap", "truncate", "overflow-hidden");
          }
        }
      });
      requestAnimationFrame(() => view.requestMeasure());
    };

    // Fungsi utilitas untuk toggle freeze column seketika di DOM
    const applyColPin = (targetColIdx: number | null) => {
      // Header
      tableData.columns.forEach((_, cIdx) => {
        const th = headerRow.children[cIdx] as HTMLElement;
        if (th) {
          if (targetColIdx === cIdx) {
            th.classList.add("sticky", "left-0", "z-20", "bg-background/95", "backdrop-blur", "shadow-[2px_0_4px_rgba(0,0,0,0.1)]");
          } else {
            th.classList.remove("sticky", "left-0", "z-20", "bg-background/95", "backdrop-blur", "shadow-[2px_0_4px_rgba(0,0,0,0.1)]");
          }
        }
      });
      // Cells
      const allRows = tbody.querySelectorAll("tr");
      allRows.forEach((tr) => {
        tableData.columns.forEach((_, cIdx) => {
          const td = tr.children[cIdx] as HTMLElement;
          if (td) {
            if (targetColIdx === cIdx) {
              td.classList.add("sticky", "left-0", "z-10", "bg-background/95", "backdrop-blur", "shadow-[2px_0_4px_rgba(0,0,0,0.08)]");
            } else {
              td.classList.remove("sticky", "left-0", "z-10", "bg-background/95", "backdrop-blur", "shadow-[2px_0_4px_rgba(0,0,0,0.08)]");
            }
          }
        });
      });
      requestAnimationFrame(() => view.requestMeasure());
    };

    tableData.columns.forEach((col, cIdx) => {
      const th = document.createElement("th");
      const isPinned = layout!.pinnedColIndex === cIdx;

      // pt-4 memberikan ruang vertikal yang aman agar handle top-1 tidak terpotong oleh overflow wrapper
      th.className = `pt-4 pb-1.5 px-2 border-r border-border/25 relative group/th ${
        isPinned ? "sticky left-0 z-20 bg-background/95 backdrop-blur shadow-[2px_0_4px_rgba(0,0,0,0.1)]" : ""
      }`;

      // Handle Kolom: top-1 aman di dalam th, tidak akan pernah tercrop
      const colGrip = document.createElement("button");
      colGrip.type = "button";
      colGrip.title = "Opsi Kolom";
      colGrip.className = "absolute top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-muted/90 text-muted-foreground hover:bg-primary hover:text-primary-foreground text-[9px] leading-none opacity-0 group-hover/th:opacity-100 transition-opacity cursor-pointer z-10 shadow-sm border border-border/40";
      colGrip.textContent = ":::";
      colGrip.addEventListener("click", (e) => {
        e.stopPropagation();
        showCompactMenu(colGrip, [
          {
            label: "Sort by column (A to Z)",
            icon: "↓A",
            onClick: () => {
              const sorted = [...tableData.rows].sort((a, b) => (a[cIdx] || "").localeCompare(b[cIdx] || "", undefined, { numeric: true }));
              updateDoc({ ...tableData, rows: sorted });
            },
          },
          {
            label: "Sort by column (Z to A)",
            icon: "↑Z",
            onClick: () => {
              const sorted = [...tableData.rows].sort((a, b) => (b[cIdx] || "").localeCompare(a[cIdx] || "", undefined, { numeric: true }));
              updateDoc({ ...tableData, rows: sorted });
            },
          },
          { isSep: true, label: "", icon: "", onClick: () => {} },
          {
            label: layout!.pinnedColIndex === cIdx ? "Unfreeze column" : "Freeze column (pin to start)",
            icon: "📌",
            onClick: () => {
              layout!.pinnedColIndex = layout!.pinnedColIndex === cIdx ? null : cIdx;
              tableLayoutCache.set(tableKey, layout!);
              applyColPin(layout!.pinnedColIndex);
            },
          },
          {
            label: layout!.wrapStates[cIdx] ? "Unwrap text (single line)" : "Wrap text (multi-line)",
            icon: "↩",
            onClick: () => {
              layout!.wrapStates[cIdx] = !layout!.wrapStates[cIdx];
              tableLayoutCache.set(tableKey, layout!);
              applyColWrap(cIdx, layout!.wrapStates[cIdx]);
            },
          },
          { isSep: true, label: "", icon: "", onClick: () => {} },
          {
            label: "Add column to left",
            icon: "←+",
            onClick: () => {
              const nextCols = [...tableData.columns];
              nextCols.splice(cIdx, 0, { id: `col_${Date.now()}`, name: `Kolom`, alignment: "left" });
              const nextRows = tableData.rows.map((r) => {
                const cells = [...r];
                cells.splice(cIdx, 0, "");
                return cells;
              });
              layout!.colWidths.splice(cIdx, 0, 140);
              layout!.wrapStates.splice(cIdx, 0, false);
              tableLayoutCache.set(tableKey, layout!);
              updateDoc({ columns: nextCols, rows: nextRows });
            },
          },
          {
            label: "Add column to right",
            icon: "+→",
            onClick: () => {
              const nextCols = [...tableData.columns];
              nextCols.splice(cIdx + 1, 0, { id: `col_${Date.now()}`, name: `Kolom`, alignment: "left" });
              const nextRows = tableData.rows.map((r) => {
                const cells = [...r];
                cells.splice(cIdx + 1, 0, "");
                return cells;
              });
              layout!.colWidths.splice(cIdx + 1, 0, 140);
              layout!.wrapStates.splice(cIdx + 1, 0, false);
              tableLayoutCache.set(tableKey, layout!);
              updateDoc({ columns: nextCols, rows: nextRows });
            },
          },
          { isSep: true, label: "", icon: "", onClick: () => {} },
          {
            label: "Align left",
            icon: "⫷",
            onClick: () => {
              const nextCols = [...tableData.columns];
              nextCols[cIdx] = { ...nextCols[cIdx], alignment: "left" };
              updateDoc({ ...tableData, columns: nextCols });
            },
          },
          {
            label: "Align center",
            icon: "☰",
            onClick: () => {
              const nextCols = [...tableData.columns];
              nextCols[cIdx] = { ...nextCols[cIdx], alignment: "center" };
              updateDoc({ ...tableData, columns: nextCols });
            },
          },
          {
            label: "Align right",
            icon: "⫸",
            onClick: () => {
              const nextCols = [...tableData.columns];
              nextCols[cIdx] = { ...nextCols[cIdx], alignment: "right" };
              updateDoc({ ...tableData, columns: nextCols });
            },
          },
          { isSep: true, label: "", icon: "", onClick: () => {} },
          {
            label: "Duplicate column",
            icon: "❐",
            onClick: () => {
              const source = tableData.columns[cIdx];
              const nextCols = [...tableData.columns];
              nextCols.splice(cIdx + 1, 0, { ...source, id: `col_${Date.now()}`, name: `${source.name} (Copy)` });
              const nextRows = tableData.rows.map((r) => {
                const cells = [...r];
                cells.splice(cIdx + 1, 0, r[cIdx] || "");
                return cells;
              });
              layout!.colWidths.splice(cIdx + 1, 0, layout!.colWidths[cIdx]);
              layout!.wrapStates.splice(cIdx + 1, 0, layout!.wrapStates[cIdx]);
              tableLayoutCache.set(tableKey, layout!);
              updateDoc({ columns: nextCols, rows: nextRows });
            },
          },
          ...(tableData.columns.length > 1
            ? [
                {
                  label: "Delete column",
                  icon: "🗑",
                  isDestructive: true,
                  onClick: () => {
                    const nextCols = tableData.columns.filter((_, i) => i !== cIdx);
                    const nextRows = tableData.rows.map((r) => r.filter((_, i) => i !== cIdx));
                    layout!.colWidths.splice(cIdx, 1);
                    layout!.wrapStates.splice(cIdx, 1);
                    tableLayoutCache.set(tableKey, layout!);
                    updateDoc({ columns: nextCols, rows: nextRows });
                  },
                },
              ]
            : []),
        ]);
      });
      th.appendChild(colGrip);

      // Input teks nama header
      const input = document.createElement("input");
      input.type = "text";
      input.value = col.name;
      input.className = "w-full bg-transparent border-none font-semibold text-foreground focus:outline-none focus:bg-muted/40 rounded px-1 py-0.5 truncate text-left";
      input.addEventListener("change", (e) => {
        const val = (e.target as HTMLInputElement).value;
        const nextCols = [...tableData.columns];
        nextCols[cIdx] = { ...nextCols[cIdx], name: val };
        updateDoc({ ...tableData, columns: nextCols });
      });
      th.appendChild(input);

      // Resizer Drag Lebar Kolom
      const colResizer = document.createElement("div");
      colResizer.className = "absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 transition-colors z-10";
      colResizer.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startW = layout!.colWidths[cIdx] || th.offsetWidth;

        const onPointerMove = (moveEvt: PointerEvent) => {
          const delta = moveEvt.clientX - startX;
          const newW = Math.max(70, startW + delta);
          layout!.colWidths[cIdx] = newW;
          const targetCol = colgroup.children[cIdx] as HTMLElement;
          if (targetCol) targetCol.style.width = `${newW}px`;
        };

        const onPointerUp = () => {
          tableLayoutCache.set(tableKey, layout!);
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          requestAnimationFrame(() => view.requestMeasure());
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
      });
      th.appendChild(colResizer);

      headerRow.appendChild(th);
    });

    // Tombol Tambah Kolom (+) di Sisi Paling Kanan Header
    const addColTh = document.createElement("th");
    addColTh.className = "w-8 px-1 py-1 text-center align-middle border-l border-border/20 pt-4";
    const addColBtn = document.createElement("button");
    addColBtn.type = "button";
    addColBtn.textContent = "+";
    addColBtn.title = "Tambah Kolom ke Kanan";
    addColBtn.className = "opacity-40 hover:opacity-100 text-muted-foreground hover:text-foreground text-xs font-bold transition-opacity px-1 rounded hover:bg-muted/40 cursor-pointer";
    addColBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const colNum = tableData.columns.length + 1;
      const nextCols = [...tableData.columns, { id: `col_${colNum}`, name: `Kolom ${colNum}`, alignment: "left" as const }];
      const nextRows = tableData.rows.map((r) => [...r, ""]);
      layout!.colWidths.push(140);
      layout!.wrapStates.push(false);
      tableLayoutCache.set(tableKey, layout!);
      updateDoc({ columns: nextCols, rows: nextRows });
    });
    addColTh.appendChild(addColBtn);
    headerRow.appendChild(addColTh);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 4. TBODY
    const tbody = document.createElement("tbody");
    tbody.className = "divide-y divide-border/20";

    tableData.rows.forEach((row, rIdx) => {
      const tr = document.createElement("tr");
      tr.style.minHeight = `${layout!.rowHeights[rIdx] || 34}px`;
      tr.className = "even:bg-muted/5 hover:bg-muted/15 transition-colors relative group/row";

      row.forEach((cellVal, cIdx) => {
        const td = document.createElement("td");
        const isPinned = layout!.pinnedColIndex === cIdx;
        const isWrapped = layout!.wrapStates[cIdx];

        td.className = `px-2 py-1.5 border-r border-border/20 align-top relative ${
          isPinned ? "sticky left-0 z-10 bg-background/95 backdrop-blur shadow-[2px_0_4px_rgba(0,0,0,0.08)]" : ""
        }`;

        // Sel Menggunakan DIV Contenteditable: Mendukung Multi-Line Wrapping Seutuhnya
        const cellEditor = document.createElement("div");
        cellEditor.contentEditable = "true";
        cellEditor.spellcheck = false;
        cellEditor.textContent = cellVal;
        cellEditor.className = `cm-table-cell-editor w-full min-h-[22px] bg-transparent border-none text-foreground focus:outline-none focus:bg-muted/40 rounded px-1 py-0.5 text-xs transition-colors ${
          isWrapped
            ? "whitespace-normal break-words leading-relaxed"
            : "whitespace-nowrap truncate overflow-hidden"
        }`;

        // Tombol Enter pindah baris ke bawah; Tab pindah kolom ke samping
        cellEditor.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const nextTr = tbody.children[rIdx + 1] as HTMLElement;
            const targetEditor = nextTr?.children[cIdx]?.querySelector<HTMLElement>(".cm-table-cell-editor");
            if (targetEditor) {
              targetEditor.focus();
            } else {
              cellEditor.blur();
            }
          } else if (e.key === "Tab") {
            e.preventDefault();
            const targetCIdx = e.shiftKey ? cIdx - 1 : cIdx + 1;
            const targetEditor = tr.children[targetCIdx]?.querySelector<HTMLElement>(".cm-table-cell-editor");
            if (targetEditor) {
              targetEditor.focus();
            }
          }
        });

        // Simpan dokumen saat selesai mengetik (blur)
        cellEditor.addEventListener("blur", () => {
          const newVal = (cellEditor.textContent || "").replace(/\n/g, " ").trim();
          if (newVal !== cellVal) {
            const nextRows = tableData.rows.map((r, i) => (i === rIdx ? r.map((c, j) => (j === cIdx ? newVal : c)) : r));
            updateDoc({ ...tableData, rows: nextRows });
          }
        });

        td.appendChild(cellEditor);
        tr.appendChild(td);
      });

      // Tombol Hapus Baris (×) di Kanan Baris
      const actionTd = document.createElement("td");
      actionTd.className = "w-8 px-1 py-1 text-center align-middle border-l border-border/20";
      const delRowBtn = document.createElement("button");
      delRowBtn.type = "button";
      delRowBtn.textContent = "×";
      delRowBtn.title = "Hapus Baris Ini";
      delRowBtn.className = "opacity-0 group-hover/row:opacity-100 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded px-1 text-xs transition-opacity cursor-pointer";
      delRowBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const nextRows = tableData.rows.filter((_, i) => i !== rIdx);
        layout!.rowHeights.splice(rIdx, 1);
        tableLayoutCache.set(tableKey, layout!);
        updateDoc({ ...tableData, rows: nextRows });
      });
      actionTd.appendChild(delRowBtn);
      tr.appendChild(actionTd);

      // Resizer Drag Tinggi Baris
      const rowResizer = document.createElement("div");
      rowResizer.className = "absolute left-0 right-0 bottom-0 h-1.5 cursor-row-resize hover:bg-primary/50 transition-colors z-10";
      rowResizer.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startY = e.clientY;
        const startH = layout!.rowHeights[rIdx] || tr.offsetHeight;

        const onPointerMove = (moveEvt: PointerEvent) => {
          const delta = moveEvt.clientY - startY;
          const newH = Math.max(26, startH + delta);
          layout!.rowHeights[rIdx] = newH;
          tr.style.minHeight = `${newH}px`;
        };

        const onPointerUp = () => {
          tableLayoutCache.set(tableKey, layout!);
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          requestAnimationFrame(() => view.requestMeasure());
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
      });
      tr.appendChild(rowResizer);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    scrollWrapper.appendChild(table);
    container.appendChild(scrollWrapper);

    // 5. TOMBOL TAMBAH BARIS (+ Tambah Baris) DI BAWAH KIRI
    const addRowBar = document.createElement("div");
    addRowBar.className = "pt-1 text-left";
    const addRowBtn = document.createElement("button");
    addRowBtn.type = "button";
    addRowBtn.textContent = "+ Tambah Baris";
    addRowBtn.className = "text-[11px] text-muted-foreground/60 hover:text-foreground font-medium px-1.5 py-0.5 rounded hover:bg-muted/30 transition-colors cursor-pointer";
    addRowBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const nextRows = [...tableData.rows, tableData.columns.map(() => "")];
      layout!.rowHeights.push(34);
      tableLayoutCache.set(tableKey, layout!);
      updateDoc({ ...tableData, rows: nextRows });
    });
    addRowBar.appendChild(addRowBtn);
    container.appendChild(addRowBar);

    // Sinkronkan pengukuran tinggi CodeMirror begitu elemen selesai dirender di DOM
    requestAnimationFrame(() => {
      view.requestMeasure();
    });

    return container;
  }

  ignoreEvent() {
    return true;
  }
}

function buildTableDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  syntaxTree(state).iterate({
    from: 0,
    to: state.doc.length,
    enter: (node) => {
      if (node.name === "Table") {
        const rawMarkdown = state.sliceDoc(node.from, node.to);
        builder.add(
          node.from,
          node.to,
          Decoration.replace({
            widget: new ObsidianTableWidget(rawMarkdown, node.from, node.to),
            block: true,
          })
        );
        return false;
      }
    },
  });

  return builder.finish();
}

export const tableLivePreviewField = StateField.define<DecorationSet>({
  create(state) {
    return buildTableDecorations(state);
  },
  update(decorations, tr) {
    if (tr.docChanged) {
      return buildTableDecorations(tr.state);
    }
    return decorations.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function tableLivePreviewPlugin() {
  return tableLivePreviewField;
}