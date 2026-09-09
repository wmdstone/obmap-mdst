import { useState, useRef, useCallback } from "react";
import { cn } from "@/shared/lib";
import { X, Plus, GripVertical, FileText, Network } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ScrollArea, ScrollBar } from "@/shared/ui/scroll-area";

export type PaneType = "editor" | "graph";

export interface WorkspaceTab {
  id: string;
  type: PaneType;
  title: string;
  nodeId?: string;
}

interface WorkspaceTabsProps {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabReorder: (tabs: WorkspaceTab[]) => void;
  onNewTab: (type: PaneType) => void;
}

export function WorkspaceTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onNewTab,
}: WorkspaceTabsProps) {
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const dragStartIndex = useRef<number | null>(null);

  const handleDragStart = useCallback((tabId: string, index: number, e: React.DragEvent) => {
    setDraggedTab(tabId);
    dragStartIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tabId);
  }, []);

  const handleDragOver = useCallback((tabId: string, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedTab && draggedTab !== tabId) {
      setDragOverTab(tabId);
    }
  }, [draggedTab]);

  const handleDragEnd = useCallback(() => {
    if (draggedTab && dragOverTab && draggedTab !== dragOverTab) {
      const fromIndex = tabs.findIndex((t) => t.id === draggedTab);
      const toIndex = tabs.findIndex((t) => t.id === dragOverTab);

      if (fromIndex !== -1 && toIndex !== -1) {
        const newTabs = [...tabs];
        const [movedTab] = newTabs.splice(fromIndex, 1);
        newTabs.splice(toIndex, 0, movedTab);
        onTabReorder(newTabs);
      }
    }
    setDraggedTab(null);
    setDragOverTab(null);
    dragStartIndex.current = null;
  }, [draggedTab, dragOverTab, tabs, onTabReorder]);

  const getTabIcon = (type: PaneType) => {
    switch (type) {
      case "editor":
        return <FileText className="w-3.5 h-3.5" />;
      case "graph":
        return <Network className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="h-10 bg-muted/30 border-b border-border flex items-center">
      <ScrollArea className="flex-1 h-full">
        <div className="flex items-center h-full px-1 gap-0.5">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(tab.id, index, e)}
              onDragOver={(e) => handleDragOver(tab.id, e)}
              onDragEnd={handleDragEnd}
              className={cn(
                "group relative flex items-center gap-1.5 h-8 px-3 rounded-t-lg cursor-pointer transition-all duration-150",
                "border border-transparent",
                activeTabId === tab.id
                  ? "bg-background border-border border-b-background text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                draggedTab === tab.id && "opacity-50",
                dragOverTab === tab.id && "border-l-2 border-l-primary"
              )}
              onClick={() => onTabSelect(tab.id)}
            >
              <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-50 cursor-grab shrink-0" />
              {getTabIcon(tab.type)}
              <span className="text-xs font-medium max-w-[120px] truncate">{tab.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className={cn(
                  "ml-1 p-0.5 rounded hover:bg-muted transition-colors shrink-0",
                  "opacity-0 group-hover:opacity-100",
                  activeTabId === tab.id && "opacity-100"
                )}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>

      {/* New Tab Button */}
      <div className="flex items-center gap-0.5 px-2 border-l border-border h-full">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onNewTab("editor")}
          title="New Editor Tab"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
