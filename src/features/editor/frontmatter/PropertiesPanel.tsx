import { useMemo, useState } from "react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Plus, X, Type, Hash, Calendar, ToggleLeft, ListOrdered } from "lucide-react";
import type { FrontmatterProperty, FrontmatterPropertyType } from "@/features/editor/types";
import { parseFrontmatter, writeFrontmatter } from "@/features/editor/cm/extensions/frontmatterField";

interface PropertiesPanelProps {
  /** Full markdown document (frontmatter + body). */
  value: string;
  onChange: (next: string) => void;
}

const TYPE_ICON: Record<FrontmatterPropertyType, typeof Type> = {
  text: Type,
  number: Hash,
  date: Calendar,
  checkbox: ToggleLeft,
  tags: Hash,
  list: ListOrdered,
};

export const PropertiesPanel = ({ value, onChange }: PropertiesPanelProps) => {
  const [newKey, setNewKey] = useState("");
  const info = useMemo(() => parseFrontmatter(value), [value]);

  const commit = (properties: FrontmatterProperty[]) => {
    onChange(writeFrontmatter(value, properties));
  };

  const updateValue = (key: string, next: unknown) => {
    commit(info.properties.map((p) => (p.key === key ? { ...p, value: next } : p)));
  };

  const removeProperty = (key: string) => {
    commit(info.properties.filter((p) => p.key !== key));
  };

  const addProperty = () => {
    const key = newKey.trim();
    if (!key || info.properties.some((p) => p.key === key)) return;
    commit([...info.properties, { key, type: key === "tags" ? "tags" : "text", value: key === "tags" ? [] : "" }]);
    setNewKey("");
  };

  return (
    <div className="space-y-2">
      {info.error && (
        <p className="text-xs text-destructive">Properties could not be read: {info.error}</p>
      )}

      {info.properties.map((property) => {
        const Icon = TYPE_ICON[property.type] ?? Type;
        return (
          <div key={property.key} className="flex items-start gap-3 group">
            <div className="flex w-36 shrink-0 items-center gap-2 pt-1.5 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              <span className="truncate">{property.key}</span>
            </div>

            <div className="min-w-0 flex-1">
              {property.type === "checkbox" ? (
                <Checkbox
                  checked={Boolean(property.value)}
                  onCheckedChange={(checked) => updateValue(property.key, checked === true)}
                  className="mt-1.5"
                />
              ) : property.type === "tags" || property.type === "list" ? (
                <TagListInput
                  values={Array.isArray(property.value) ? property.value.map(String) : []}
                  onChange={(next) => updateValue(property.key, next)}
                />
              ) : (
                <Input
                  type={property.type === "number" ? "number" : property.type === "date" ? "date" : "text"}
                  value={property.value === null || property.value === undefined ? "" : String(property.value)}
                  onChange={(e) =>
                    updateValue(
                      property.key,
                      property.type === "number" ? Number(e.target.value) : e.target.value
                    )
                  }
                  className="h-8 border-none bg-transparent px-2 text-sm shadow-none focus-visible:ring-0"
                />
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => removeProperty(property.key)}
              aria-label={`Remove ${property.key}`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}

      <div className="flex items-center gap-2 pt-1">
        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
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
          className="h-7 w-40 border-none bg-transparent px-2 text-xs shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
};

const TagListInput = ({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) => {
  const [draft, setDraft] = useState("");

  const add = () => {
    const item = draft.trim().replace(/^#/, "");
    if (item && !values.includes(item)) onChange([...values, item]);
    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
      {values.map((item) => (
        <Badge
          key={item}
          variant="secondary"
          className="cursor-pointer px-2 py-0.5 text-xs font-normal"
          onClick={() => onChange(values.filter((v) => v !== item))}
        >
          {item}
          <X className="ml-1 h-3 w-3" />
        </Badge>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder="+"
        className="h-6 w-20 border-none bg-transparent px-1.5 text-xs shadow-none focus-visible:ring-0"
      />
    </div>
  );
};
