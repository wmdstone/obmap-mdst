import React, { useState } from "react";
import type { SystemMetrics } from "@/types/admin";
import type { AuditLogRecord } from "@/types/collaboration";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Activity,
  Database,
  Layers,
  FileText,
  Clock,
  Search,
  CheckCircle2,
  Users,
} from "lucide-react";

interface Props {
  metrics: SystemMetrics | null;
  auditLogs: AuditLogRecord[];
}

export const HealthMetricsTab: React.FC<Props> = ({ metrics, auditLogs }) => {
  const [filterAction, setFilterAction] = useState("");

  const filteredLogs = auditLogs.filter((log) => {
    if (!filterAction) return true;
    const q = filterAction.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.resource_type.toLowerCase().includes(q) ||
      log.actor_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Kartu Ringkasan Metrik Telemetri */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Latensi Database
            </CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-baseline gap-1.5">
              {metrics ? `${metrics.dbPingMs} ms` : "..."}
              <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-500/10">
                Lancar
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ping round-trip PostgreSQL</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Catatan
            </CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalNotes ?? 0}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="text-emerald-600 font-medium">{metrics?.publishedNotes ?? 0} Terbit</span>
              <span>•</span>
              <span>{metrics?.inReviewNotes ?? 0} Review</span>
              <span>•</span>
              <span>{metrics?.draftNotes ?? 0} Draf</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Vault
            </CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalVaults ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Ruang kerja pengetahuan aktif</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Pengguna
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalUsers ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Akun terdaftar dalam sistem</p>
          </CardContent>
        </Card>
      </div>

      {/* Feed Audit Trail */}
      <Card className="bg-card">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold">Jejak Audit Sistem (Audit Trail)</CardTitle>
            <CardDescription className="text-xs">
              Merekam seluruh aktivitas penting termasuk publikasi catatan dan perubahan peran.
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter aksi audit..."
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-80 pr-4">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Belum ada aktivitas audit log yang tercatat.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => {
                  const dateStr = new Date(log.created_at).toLocaleString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <div
                      key={log.id}
                      className="p-3 border rounded-lg bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-semibold px-1.5 py-0.5 bg-muted rounded">
                              {log.action}
                            </span>
                            <span className="text-muted-foreground text-xs">pada entitas</span>
                            <Badge variant="outline" className="text-[10px]">
                              {log.resource_type}
                            </Badge>
                          </div>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <pre className="text-[11px] text-muted-foreground font-mono mt-1 bg-muted/30 p-1.5 rounded overflow-x-auto max-w-xl">
                              {JSON.stringify(log.metadata)}
                            </pre>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 self-start sm:self-center">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};