import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Textarea } from "@/shared/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Plus,
  X,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  ListOrdered,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Code2,
  Lock,
} from "lucide-react";
import { cn } from "@/shared/lib";
import { useNodeStore } from "@/shared/stores";
import type {
  FrontmatterProperty,
  FrontmatterPropertyType,
} from "@/core/editor/types";
import {
  parseFrontmatter,
  writeFrontmatter,
  writeRawFrontmatter,
} from "@/core/editor/cm/extensions/frontmatterField";
import {
  detectListLayout,
  isReservedKey,
  normalizeTag,
  propertiesToYaml,
  reservedType,
  tagSegments,
  toStringList,
  type ListLayout,
} from "@/core/editor/frontmatter/frontmatter-utils";
import {
  useResolvedSchema,
  useSchemaStore,
  type ResolvedProperty,
} from "@/core/system/schema";

const isEmptyValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0);

const TYPE_ICON: Record<FrontmatterPropertyType, typeof Type> = {
  text: Type,
  number: Hash,
  date: Calendar,
  checkbox: ToggleLeft,
  select: ChevronDown,
  tags: Hash,
  list: ListOrdered,
};

const TYPE_LABEL: Record<FrontmatterPropertyType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  checkbox: "Checkbox",
  select: "Select",
  tags: "Tags",
  list: "List",
};

const TYPES = Object.keys(TYPE_LABEL) as FrontmatterPropertyType[];

const coerceValue = (
  value: unknown,
  type: FrontmatterPropertyType,
): unknown => {
  switch (type) {
    case "tags":
    case "list":
      return toStringList(value);
    case "checkbox":
      return Boolean(value);
    case "number": {
      const n = Number(Array.isArray(value) ? value[0] : value);
      return Number.isFinite(n) ? n : 0;
    }
    default: {
      const v = Array.isArray(value) ? value[0] : value;
      return v === null || v === undefined ? "" : String(v);
    }
  }
};

interface PropertiesPanelProps {
  value: string;
  onChange: (next: string) => void;
}

export const PropertiesPanel = ({ value, onChange }: PropertiesPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(true); // Notion-like collapse
  const [newKey, setNewKey] = useState("");
  const [listLayout, setListLayout] = useState<ListLayout>("block");
  const [rawMode, setRawMode] = useState(false);
  const [rawDraft, setRawDraft] = useState("");
  const [dragRow, setDragRow] = useState<number | null>(null);

  const info = useMemo(() => parseFrontmatter(value), [value]);
  const properties = info.properties;

  useEffect(() => {
    if (info.raw) setListLayout(detectListLayout(info.raw));
  }, [info.raw]);

  const frontmatterRecord = useMemo(
    () =>
      Object.fromEntries(properties.map((p) => [p.key, p.value])) as Record<
        string,
        unknown
      >,
    [properties],
  );
  const rules = useResolvedSchema(frontmatterRecord);
  const strictMode = useSchemaStore((s) => s.schema.strictMode);
  const ruleFor = (key: string) => rules.find((r) => r.key === key);

  const missingRequired = rules.filter(
    (r) => r.required && !properties.some((p) => p.key === r.key),
  );
  const emptyRequired = rules.filter(
    (r) =>
      r.required &&
      properties.some((p) => p.key === r.key && isEmptyValue(p.value)),
  );

  const nodes = useNodeStore((state) => state.nodes);
  const knownTags = useMemo(() => {
    const set = new Set<string>();
    nodes.forEach((n) => n.tags?.forEach((t) => set.add(normalizeTag(t))));
    rules.forEach((r) => {
      if (r.taxonomyPrefix) set.add(normalizeTag(r.taxonomyPrefix));
    });
    return Array.from(set).filter(Boolean).sort();
  }, [nodes, rules]);

  const commit = (
    next: FrontmatterProperty[],
    layout: ListLayout = listLayout,
  ) => {
    onChange(writeFrontmatter(value, next, layout));
  };

  const actions = {
    updateValue: (key: string, next: unknown) => {
      commit(
        properties.map((p) => (p.key === key ? { ...p, value: next } : p)),
      );
    },
    renameKey: (key: string, nextKeyRaw: string) => {
      const nextKey = nextKeyRaw.trim();
      if (!nextKey || nextKey === key) return;
      if (properties.some((p) => p.key.toLowerCase() === nextKey.toLowerCase()))
        return;
      commit(
        properties.map((p) =>
          p.key === key
            ? {
                ...p,
                key: nextKey,
                type: reservedType(nextKey) ?? p.type,
                value: coerceValue(p.value, reservedType(nextKey) ?? p.type),
              }
            : p,
        ),
      );
    },
    changeType: (key: string, type: FrontmatterPropertyType) => {
      commit(
        properties.map((p) =>
          p.key === key ? { ...p, type, value: coerceValue(p.value, type) } : p,
        ),
      );
    },
    removeProperty: (key: string) => {
      commit(properties.filter((p) => p.key !== key));
    },
    moveRow: (from: number, to: number) => {
      if (from === to || to < 0 || to >= properties.length) return;
      const next = [...properties];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      commit(next);
    },
  };

  const addProperty = () => {
    const key = newKey.trim();
    setNewKey("");
    if (
      !key ||
      properties.some((p) => p.key.toLowerCase() === key.toLowerCase())
    )
      return;

    const rule = ruleFor(key);
    const type =
      reservedType(key) ?? (rule?.type as FrontmatterPropertyType) ?? "text";
    commit([
      ...properties,
      { key, type, value: coerceValue(rule?.defaultValue ?? "", type) },
    ]);
  };

  const addMissingRequired = () => {
    const seeded = missingRequired.map((rule) => {
      const type = (reservedType(rule.key) ??
        rule.type) as FrontmatterPropertyType;
      return {
        key: rule.key,
        type,
        value: coerceValue(rule.defaultValue ?? "", type),
      };
    });
    commit([...seeded, ...properties]);
  };

  const duplicateKey = Boolean(
    newKey.trim() &&
    properties.some(
      (p) => p.key.trim().toLowerCase() === newKey.trim().toLowerCase(),
    ),
  );

  const yamlPreview = propertiesToYaml(properties, listLayout);

  const rank = (key: string): number => {
    const rule = ruleFor(key);
    if (!rule) return 2;
    if (rule.required) return 0;
    return rule.visibility === "always" ? 1 : 3;
  };

  const rows = properties
    .map((property, index) => ({ property, index, rank: rank(property.key) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index);

  const primaryRows = rows.filter((r) => r.rank < 3);
  const secondaryRows = rows.filter((r) => r.rank === 3);

  return (
    <section className="mb-6 space-y-2 border-b border-border/40 pb-4">
      {/* Notion-like Collapsible Header */}
      <header className="group flex items-center justify-between py-1">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isExpanded && "rotate-90",
            )}
          />
          Properties
          {!isExpanded && properties.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground/60">
              {properties.length}
            </span>
          )}
        </button>

        {isExpanded && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6",
                rawMode && "bg-accent text-accent-foreground",
              )}
              onClick={() =>
                rawMode
                  ? setRawMode(false)
                  : (setRawDraft(yamlPreview), setRawMode(true))
              }
              title="Toggle Raw YAML"
            >
              <Code2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </header>

      {info.error && (
        <p className="text-xs text-destructive px-5">{info.error}</p>
      )}

      {isExpanded && (
        <div className="px-2 pl-6 animate-in fade-in slide-in-from-top-2 duration-200">
          {rawMode ? (
            <div className="space-y-2">
              <Textarea
                value={rawDraft}
                onChange={(e) => setRawDraft(e.target.value)}
                spellCheck={false}
                rows={Math.max(4, rawDraft.split("\n").length + 1)}
                className="font-mono text-xs bg-muted/30 focus-visible:ring-1"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    onChange(writeRawFrontmatter(value, rawDraft));
                    setRawMode(false);
                  }}
                >
                  Apply YAML
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRawMode(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {(missingRequired.length > 0 ||
                (strictMode && emptyRequired.length > 0)) && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-3 py-2 text-destructive">
                  <p className="text-xs">
                    {missingRequired.length > 0
                      ? `Missing: ${missingRequired.map((r) => r.key).join(", ")}`
                      : `Empty: ${emptyRequired.map((r) => r.key).join(", ")}`}
                  </p>
                  {missingRequired.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      onClick={addMissingRequired}
                    >
                      Add Required
                    </Button>
                  )}
                </div>
              )}

              {/* Primary Properties */}
              {primaryRows.map(({ property, index }) => (
                <PropertyRow
                  key={property.key}
                  property={property}
                  index={index}
                  rule={ruleFor(property.key)}
                  strictMode={strictMode}
                  dragRow={dragRow}
                  setDragRow={setDragRow}
                  actions={actions}
                  nodes={nodes}
                  knownTags={knownTags}
                />
              ))}

              {/* System Config / Secondary Properties */}
              {secondaryRows.length > 0 && (
                <details className="group/details mt-2">
                  <summary className="cursor-pointer select-none py-1.5 text-xs text-muted-foreground/70 hover:text-foreground marker:content-[''] flex items-center gap-1">
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-open/details:rotate-90" />
                    System configuration ({secondaryRows.length})
                  </summary>
                  <div className="ml-1 mt-1 flex flex-col gap-0.5 border-l border-border/40 pl-3">
                    {secondaryRows.map(({ property, index }) => (
                      <PropertyRow
                        key={property.key}
                        property={property}
                        index={index}
                        rule={ruleFor(property.key)}
                        strictMode={strictMode}
                        dragRow={dragRow}
                        setDragRow={setDragRow}
                        actions={actions}
                        nodes={nodes}
                        knownTags={knownTags}
                      />
                    ))}
                  </div>
                </details>
              )}

              {/* Add Property Input */}
              <div className="group mt-1 flex items-center gap-2 rounded-md py-1 transition-colors hover:bg-accent/30">
                <div className="flex w-[140px] shrink-0 items-center gap-1.5 pl-6 text-muted-foreground/60 group-hover:text-muted-foreground">
                  <Plus className="h-3.5 w-3.5" />
                  <Input
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addProperty();
                      }
                    }}
                    onBlur={addProperty}
                    placeholder="Add property"
                    className="h-6 w-full border-none bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                  />
                </div>
                {duplicateKey && (
                  <span className="text-[10px] text-destructive">
                    Key exists
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

// --- Sub Components ---

const PropertyRow = ({
  property,
  index,
  rule,
  strictMode,
  dragRow,
  setDragRow,
  actions,
  nodes,
  knownTags,
}: {
  property: FrontmatterProperty;
  index: number;
  rule?: ResolvedProperty;
  strictMode?: boolean;
  dragRow: number | null;
  setDragRow: (i: number | null) => void;
  actions: any; // Type accurately mapped to the actions object above
  nodes: any[];
  knownTags: string[];
}) => {
  const Icon = TYPE_ICON[property.type] ?? Type;
  const mandatory = Boolean(rule?.required);
  const reserved = isReservedKey(property.key) || mandatory;
  const invalid = strictMode && mandatory && isEmptyValue(property.value);

  return (
    <div
      className={cn(
        "group flex items-center min-h-[32px] rounded-md transition-colors hover:bg-accent/40",
        dragRow === index && "bg-accent",
        invalid && "bg-destructive/10",
      )}
      onDragOver={(e) => dragRow !== null && e.preventDefault()}
      onDrop={(e) => {
        if (dragRow === null) return;
        e.preventDefault();
        actions.moveRow(dragRow, index);
        setDragRow(null);
      }}
    >
      {/* Left Column: Key & Actions */}
      <div className="flex w-[140px] shrink-0 items-center gap-1 py-1 pr-2">
        {/* Drag Handle */}
        <button
          type="button"
          draggable
          onDragStart={() => setDragRow(index)}
          onDragEnd={() => setDragRow(null)}
          className="cursor-grab p-1 text-muted-foreground/30 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {/* Type Icon Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={reserved}>
            <button className="flex shrink-0 items-center justify-center rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50">
              <Icon className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            {TYPES.map((t) => {
              const TIcon = TYPE_ICON[t];
              return (
                <DropdownMenuItem
                  key={t}
                  onSelect={() => actions.changeType(property.key, t)}
                >
                  <TIcon className="mr-2 h-3.5 w-3.5" /> {TYPE_LABEL[t]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Key Name Input */}
        <Input
          defaultValue={property.key}
          key={`${property.key}-key`}
          readOnly={reserved}
          onBlur={(e) => actions.renameKey(property.key, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="h-6 w-full truncate border-none bg-transparent px-1 text-xs text-muted-foreground shadow-none focus-visible:ring-0 focus-visible:text-foreground"
        />

        {reserved && (
          <Lock className="h-3 w-3 shrink-0 text-muted-foreground/40" />
        )}
      </div>

      {/* Right Column: Value Input */}
      <div className="flex-1 min-w-0 py-1 flex items-center pr-2">
        {property.type === "checkbox" ? (
          <Checkbox
            checked={Boolean(property.value)}
            onCheckedChange={(c) =>
              actions.updateValue(property.key, c === true)
            }
            className="ml-2 data-[state=checked]:bg-primary"
          />
        ) : property.type === "tags" || property.type === "list" ? (
          <ListValueInput
            propertyKey={property.key}
            isTags={property.type === "tags"}
            values={toStringList(property.value)}
            suggestions={property.type === "tags" ? knownTags : []}
            onChange={(next) => actions.updateValue(property.key, next)}
          />
        ) : property.type === "select" ? (
          <SelectValueInput
            propertyKey={property.key}
            value={String(property.value ?? "")}
            options={optionsForKey(nodes, property.key)}
            onChange={(next) => actions.updateValue(property.key, next)}
          />
        ) : (
          <Input
            type={
              property.type === "number"
                ? "number"
                : property.type === "date"
                  ? "date"
                  : "text"
            }
            value={
              property.value === null || property.value === undefined
                ? ""
                : String(property.value)
            }
            onChange={(e) =>
              actions.updateValue(
                property.key,
                property.type === "number"
                  ? Number(e.target.value)
                  : e.target.value,
              )
            }
            placeholder="Empty"
            className="h-6 w-full border-none bg-transparent px-2 text-xs shadow-none placeholder:text-muted-foreground/40 hover:bg-black/5 dark:hover:bg-white/5 focus-visible:bg-black/5 dark:focus-visible:bg-white/5 focus-visible:ring-0"
          />
        )}
      </div>

      {/* Delete Action (Hidden unless hovered) */}
      {!mandatory && (
        <Button
          variant="ghost"
          size="icon"
          className="mr-1 h-6 w-6 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          onClick={() => actions.removeProperty(property.key)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
};

function optionsForKey(nodes: { content: string }[], key: string): string[] {
  const set = new Set<string>();
  nodes.forEach((n) => {
    const match = n.content?.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    if (match) set.add(match[1].trim().replace(/^['"]|['"]$/g, ""));
  });
  return Array.from(set).filter(Boolean).sort();
}

const SelectValueInput = ({ propertyKey, value, options, onChange }: any) => {
  const listId = `select-${propertyKey}`;
  return (
    <>
      <Input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Empty"
        className="h-6 w-full border-none bg-transparent px-2 text-xs shadow-none placeholder:text-muted-foreground/40 hover:bg-black/5 dark:hover:bg-white/5 focus-visible:bg-black/5 dark:focus-visible:bg-white/5 focus-visible:ring-0"
      />
      <datalist id={listId}>
        {options.map((o: string) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
};

const ListValueInput = ({ isTags, values, suggestions, onChange }: any) => {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const dragIndex = useRef<number | null>(null);

  const clean = (raw: string) => (isTags ? normalizeTag(raw) : raw.trim());
  const matches = useMemo(() => {
    const q = clean(draft).toLowerCase();
    if (!q) return [];
    return suggestions
      .filter((s: string) => s.toLowerCase().includes(q) && !values.includes(s))
      .slice(0, 6);
  }, [draft, suggestions, values, isTags]);

  const add = (raw: string) => {
    const item = clean(raw);
    setDraft("");
    setOpen(false);
    if (!item || values.includes(item)) return;
    onChange([...values, item]);
  };

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= values.length) return;
    const next = [...values];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="relative flex w-full flex-wrap items-center gap-1.5 px-2">
      {values.map((item: string, index: number) => {
        const segments = tagSegments(item);
        return (
          <Badge
            key={item}
            variant="secondary"
            draggable
            onDragStart={() => (dragIndex.current = index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex.current !== null) move(dragIndex.current, index);
              dragIndex.current = null;
            }}
            className="cursor-grab gap-0.5 px-1.5 py-0 text-[11px] font-normal text-muted-foreground bg-muted hover:bg-muted/80"
          >
            {isTags && segments.length > 1 ? (
              segments.map((seg, i) => (
                <span
                  key={`${seg}-${i}`}
                  className={cn(i > 0 && "font-medium text-foreground")}
                >
                  {i > 0 && (
                    <span className="mx-0.5 text-muted-foreground/40">/</span>
                  )}
                  {seg}
                </span>
              ))
            ) : (
              <span className="text-foreground">{item}</span>
            )}
            <button
              type="button"
              onClick={() => onChange(values.filter((v: string) => v !== item))}
              className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        );
      })}
      <Input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(matches.length === 1 ? matches[0] : draft);
          }
          if (e.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => setTimeout(() => add(draft), 120)}
        placeholder={values.length === 0 ? "Empty" : ""}
        className={cn(
          "h-6 flex-1 min-w-[60px] border-none bg-transparent px-0 text-xs shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0",
          values.length === 0 &&
            "hover:bg-black/5 dark:hover:bg-white/5 focus-visible:bg-black/5 dark:focus-visible:bg-white/5 px-2 -ml-2 rounded-md",
        )}
      />

      {open && matches.length > 0 && (
        <ul className="absolute left-0 top-full z-50 mt-1 max-h-44 w-56 overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {matches.map((m: string) => (
            <li key={m}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(m);
                }}
                className="w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
