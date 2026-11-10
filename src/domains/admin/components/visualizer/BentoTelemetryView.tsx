import React, { useState } from "react";
import type { SubsystemNode } from "@/types/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/global/ui/card";
import { Badge } from "@/global/ui/badge";
import { Switch } from "@/global/ui/switch";
import { toast } from "sonner";
import { Sliders, Cpu, HardDrive, ShieldCheck, Zap, Activity } from "lucide-react";

interface Props {
  nodes: SubsystemNode[];
}

export const BentoTelemetryView: React.FC<Props> = ({ nodes }) => {
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    nodes.forEach((n) => {
      initial[n.id] = n.enabled;
    });
    return initial;
  });

  const handleToggle = (id: string, name: string) => {
    setToggleStates((prev) => {
      const next = !prev[id];
      toast.info(`Subsistem "${name}" diubah: ${next ? "Diaktifkan" : "Dinonaktifkan sementara"}`);
      return { ...prev, [id]: next };
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bento Card 1: Resource Telemetry */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-primary" />
              Alokasi Memori Heap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">42.8 MB</div>
            <p className="text-xs text-muted-foreground mt-1">Konsumsi browser client runtime</p>
          </CardContent>
        </Card>

        {/* Bento Card 2: Security Health */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Status Zero-Trust RLS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 flex items-center gap-1.5">
              Aktif Penuh
            </div>
            <p className="text-xs text-muted-foreground mt-1">6 tabel berproteksi kebijakan database</p>
          </CardContent>
        </Card>

        {/* Bento Card 3: Storage Health */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
              Media Bucket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">vault-media</div>
            <p className="text-xs text-muted-foreground mt-1">Auto-bundle & CDN proxy aktif</p>
          </CardContent>
        </Card>
      </div>

      {/* Modul Feature Toggles */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            Saklar Fitur & Telemetri Subsistem (Feature Toggles)
          </CardTitle>
          <CardDescription className="text-xs">
            Kendali langsung untuk mengisolasi atau menguji modul secara otonom tanpa mengganggu sistem lainnya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {nodes.map((node) => {
              const isEnabled = toggleStates[node.id] ?? true;

              return (
                <div
                  key={node.id}
                  className="p-3.5 border rounded-lg bg-background flex items-center justify-between gap-3 hover:border-primary/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      {node.name}
                      <Badge variant="outline" className="text-[10px]">
                        {node.category}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {node.description}
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => handleToggle(node.id, node.name)}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};