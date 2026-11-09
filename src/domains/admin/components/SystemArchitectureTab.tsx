import React, { useState } from "react";
import type { SystemTelemetryContract } from "@/types/admin";
import { LivingGraphView } from "./visualizer/LivingGraphView";
import { BentoTelemetryView } from "./visualizer/BentoTelemetryView";
import { DiagnosticsTableView } from "./visualizer/DiagnosticsTableView";
import { Button } from "@/shared/ui/button";
import { Network, Sliders, Table as TableIcon } from "lucide-react";

interface Props {
  telemetry: SystemTelemetryContract;
}

type ViewMode = "graph" | "bento" | "table";

export const SystemArchitectureTab: React.FC<Props> = ({ telemetry }) => {
  const [viewMode, setViewMode] = useState<ViewMode>("graph");

  return (
    <div className="space-y-4">
      {/* View Switcher Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Visualizer Arsitektur Sistem (3 Tampilan Otonom)
          </h2>
          <p className="text-sm text-muted-foreground">
            Beralih antar mode inspeksi modular yang mengonsumsi satu kontrak data telemetri terpadu.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg">
          <Button
            size="sm"
            variant={viewMode === "graph" ? "default" : "ghost"}
            className="h-8 text-xs gap-1.5"
            onClick={() => setViewMode("graph")}
          >
            <Network className="h-3.5 w-3.5" />
            Living Graph
          </Button>
          <Button
            size="sm"
            variant={viewMode === "bento" ? "default" : "ghost"}
            className="h-8 text-xs gap-1.5"
            onClick={() => setViewMode("bento")}
          >
            <Sliders className="h-3.5 w-3.5" />
            Bento Grid
          </Button>
          <Button
            size="sm"
            variant={viewMode === "table" ? "default" : "ghost"}
            className="h-8 text-xs gap-1.5"
            onClick={() => setViewMode("table")}
          >
            <TableIcon className="h-3.5 w-3.5" />
            Diagnostics Table
          </Button>
        </div>
      </div>

      {/* Render Tampilan Terpilih secara Otonom */}
      {viewMode === "graph" && <LivingGraphView nodes={telemetry.nodes} />}
      {viewMode === "bento" && <BentoTelemetryView nodes={telemetry.nodes} />}
      {viewMode === "table" && <DiagnosticsTableView telemetry={telemetry} />}
    </div>
  );
};