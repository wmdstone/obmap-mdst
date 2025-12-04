import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "./AppSidebar";

interface Node {
  id: string;
  name: string;
  content: string;
  type: "folder" | "file" | "media";
  parentId: string | null;
  depth: number;
  tags: string[];
  mediaType?: "image" | "audio" | "video";
}

interface MobileSidebarProps {
  nodes: Node[];
  onNodeSelect: (node: Node) => void;
  selectedNode: Node | null;
  onNodeMove?: (nodeId: string, newParentId: string | null) => void;
  isVaultMode: boolean;
  vaultName: string | null;
  onCloseVault: () => void;
  graphConfigTrigger: React.ReactNode;
  onImportComplete?: (importedNodes: Node[]) => void;
}

export function MobileSidebar({
  nodes,
  onNodeSelect,
  selectedNode,
  onNodeMove,
  isVaultMode,
  vaultName,
  onCloseVault,
  graphConfigTrigger,
  onImportComplete,
}: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleNodeSelect = (node: Node) => {
    onNodeSelect(node);
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 left-4 z-40 lg:hidden shadow-lg bg-background/95 backdrop-blur-sm"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-[300px]">
        <AppSidebar
          nodes={nodes}
          onNodeSelect={handleNodeSelect}
          selectedNode={selectedNode}
          onNodeMove={onNodeMove}
          isVaultMode={isVaultMode}
          vaultName={vaultName}
          onCloseVault={onCloseVault}
          graphConfigTrigger={graphConfigTrigger}
          onImportComplete={onImportComplete}
        />
      </SheetContent>
    </Sheet>
  );
}
