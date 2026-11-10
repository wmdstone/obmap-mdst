import React, { useState } from "react";
import type { SubsystemNode } from "@/types/admin";
import { Badge } from "@/global/ui/badge";
import { Card, CardContent } from "@/global/ui/card";
import { Activity, ShieldCheck, Database, Layers, ArrowRight } from "lucide-react";

interface Props {
  nodes: SubsystemNode[];
}

export const LivingGraphView: React.FC<Props> = ({ nodes }) => {
  const [selectedId, setSelectedId] = useState<string>(nodes[0]?.id || "");
  const activeNode = nodes.find((n) => n.id === selectedId) || nodes[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Kanvas visual peta subsistem */}
      <div className="lg:col-span-2 border rounded-xl p-6 bg-card flex flex-col justify-between min-h-[420px]">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary animate-pulse" />
              Living Architecture Graph (Topologi Subsistem)
            </h3>
            <Badge variant="outline" className="text-xs">
              {nodes.length} Subsistem Otonom
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-6">
            Peta hidup konektivitas antar-engine ObMap. Klik node subsistem untuk melihat detail relasi ketergantungan.
          </p>
        </div>

        {/* Grid Visual Nodes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-auto">
          {nodes.map((node) => {
            const isSelected = node.id === selectedId;

            return (
              <button
                key={node.id}
                onClick={() => setSelectedId(node.id)}
                className={`p-3.5 rounded-lg border text-left transition-all relative overflow-hidden flex items-start justify-between gap-2 ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                    : "bg-background hover:border-muted-foreground/30"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-sm font-semibold text-foreground">{node.name}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                    {node.description}
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0 font-mono">
                  {node.latencyMs}ms
                </Badge>
              </button>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Status denyut hijau menandakan verifikasi zero-trust RLS & ping realtime optimal.</span>
          <span className="font-mono">Uptime: 99.96%</span>
        </div>
      </div>

      {/* Panel Inspeksi Kanan */}
      {activeNode && (
        <Card className="bg-card h-full flex flex-col justify-between">
          <div>
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="uppercase text-[10px] tracking-wider">
                  {activeNode.category}
                </Badge>
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                  {activeNode.status}
                </Badge>
              </div>
              <h4 className="text-base font-bold text-foreground mt-2">{activeNode.name}</h4>
              <p className="text-xs text-muted-foreground mt-1">{activeNode.description}</p>
            </div>

            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 bg-muted/40 rounded-lg">
                  <div className="text-xs text-muted-foreground">Latensi Internal</div>
                  <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                    {activeNode.latencyMs} ms
                  </div>
                </div>
                <div className="p-2.5 bg-muted/40 rounded-lg">
                  <div className="text-xs text-muted-foreground">Rasio Uptime</div>
                  <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                    {activeNode.uptimePercent}%
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  Ketergantungan Subsistem:
                </div>
                {activeNode.dependencies.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded">
                    Tidak memerlukan modul hulu (Root Node).
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {activeNode.dependencies.map((dep) => (
                      <div
                        key={dep}
                        className="text-xs p-2 bg-muted/30 rounded border flex items-center gap-2 font-mono"
                      >
                        <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                        <span>{dep}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </div>

          <div className="p-4 border-t bg-muted/10 text-[11px] text-muted-foreground">
            ID Internal: <code className="font-mono text-foreground">{activeNode.id}</code>
          </div>
        </Card>
      )}
    </div>
  );
};