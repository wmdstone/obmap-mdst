import React from "react";
import type { LeafViewProps } from "@/domains/workspace/registry/ViewRegistry";
import { GraphOrchestrator } from "@/domains/graph/GraphOrchestrator";

export const GraphLeaf: React.FC<LeafViewProps> = ({ leaf, isActive = true }) => {
  return (
    <GraphOrchestrator
      leafId={leaf.id}
      view={leaf.view}
      isActive={isActive}
    />
  );
};

export default GraphLeaf;