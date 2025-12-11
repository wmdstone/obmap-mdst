import { cn } from "@/lib/utils";
import { FileText, Network, FolderOpen, Sparkles } from "lucide-react";
import type { PaneType } from "./WorkspaceTabs";

interface WorkspacePaneProps {
  type: PaneType;
  children?: React.ReactNode;
  isEmpty?: boolean;
  onQuickAction?: (action: string) => void;
}

const emptyStateActions = [
  { id: "new-note", icon: FileText, label: "Create a new note", description: "Start writing your thoughts" },
  { id: "open-vault", icon: FolderOpen, label: "Open a vault", description: "Access your knowledge base" },
  { id: "explore-graph", icon: Network, label: "Explore the graph", description: "Visualize connections" },
  { id: "import-files", icon: Sparkles, label: "Import files", description: "Bring in existing notes" },
];

export function WorkspacePane({ type, children, isEmpty, onQuickAction }: WorkspacePaneProps) {
  if (isEmpty) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="max-w-md w-full px-8 py-12 text-center space-y-8">
          <div className="space-y-2">
            <h2 className="text-lg font-medium text-foreground">Welcome to your workspace</h2>
            <p className="text-sm text-muted-foreground">
              Select a file from the explorer or choose an action below
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {emptyStateActions.map((action) => (
              <button
                key={action.id}
                onClick={() => onQuickAction?.(action.id)}
                className={cn(
                  "group p-4 rounded-lg border border-border/50 bg-card/50 text-left",
                  "hover:border-primary/50 hover:bg-card transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50"
                )}
              >
                <action.icon className="w-5 h-5 text-primary mb-2" />
                <p className="text-sm font-medium text-foreground">{action.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-background">
      {children}
    </div>
  );
}
