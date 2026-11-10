// src/domains/workspace/views/GraphLeaf.tsx
import React from "react";
import { GraphOrchestrator } from "@/domains/graph/GraphOrchestrator";

export const GraphLeaf: React.FC<{ leafId: string }> = ({ leafId }) => {
  return <GraphOrchestrator leafId={leafId} />;
};

export default GraphLeaf;