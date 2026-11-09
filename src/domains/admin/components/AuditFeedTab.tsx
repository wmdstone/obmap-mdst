import React, { useState } from "react";
import type { AuditLogRecord } from "@/types/collaboration";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import {
  Clock,
  Search,
  CheckCircle2,
  Download,
  Filter,
  Code2,
  Shield,
} from "lucide-react";

interface Props {
  auditLogs: AuditLogRecord[];
}

export const AuditFeedTab: React.FC<Props> = ({ auditLogs }) => {
  const [filterQuery, setFilterQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [activeLogInspect, setActiveLogInspect] = useState<AuditLogRecord | null>(null);

  // Filter Kategori Cerdas
  const filteredLogs = auditLogs.filter((log) => {
    const matchesCategory =
      categoryFilter === "all" ||
      (categoryFilter === "roles" && log.action.includes("ROLE")) ||
      (categoryFilter === "account" && log.action.includes("ACCOUNT")) ||
      (categoryFilter === "vault" && log.action.includes("VAULT")) ||
      (categoryFilter === "publish" && log.action.includes("PUBLISH"));

    const q = filterQuery.toLowerCase();
    const matchesQuery =
      !filterQuery ||
      log.action.toLowerCase().includes(q) ||
      log.resource_type.toLowerCase().includes(q) ||
      log.actor_id.toLowerCase().includes(q);

    return matchesCategory && matchesQuery;
  });

  // Ekspor CSV Sederhana
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ["ID", "Waktu", "Aktor", "Aksi", "Resource Type", "Resource ID", "Metadata"];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.created_at,
      l.actor_id,
      l.action,
      l.resource_type,
      l.resource_id,
      JSON.stringify(l.metadata || {}).replace(/"/g, '""'),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="bg-card">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Jejak Audit Keamanan (Audit Trail)
          </CardTitle>
          <CardDescription className="text-xs">
            Merekam seluruh modifikasi hak akses, publikasi catatan, dan interaksi administratif.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-48">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari aksi audit..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs h-8 gap-1.5"
            disabled={filteredLogs.length === 0}
          >
            <Download className="w-3.5 h-3.5" />
            Ekspor CSV
          </Button>
        </div>
      </CardHeader>

      {/* Kategori Quick Filters */}
      <div className="px-6 pb-2 flex flex-wrap gap-1.5 border-b">
        {[
          { id: "all", label: "Semua Aksi" },
          { id: "roles", label: "Peran Pengguna" },
          { id: "account", label: "Status Akun" },
          { id: "vault", label: "Vault Kolaborasi" },
        ].map((cat) => (
          <Button
            key={cat.id}
            variant={categoryFilter === cat.id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setCategoryFilter(cat.id)}
            className="h-7 text-[11px] px-2.5"
          >
            {cat.label}
          </Button>
        ))}
      </div>

      <CardContent className="pt-4">
        <ScrollArea className="h-96 pr-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              Belum ada aktivitas audit log yang sesuai filter.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((log) => {
                const dateStr = new Date(log.created_at).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                });

                return (
                  <div
                    key={log.id}
                    onClick={() => setActiveLogInspect(log)}
                    className="p-3 border rounded-lg bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-primary/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold flex items-center gap-2 flex-wrap">
                          <span className="font-mono px-1.5 py-0.5 bg-muted rounded text-[11px]">
                            {log.action}
                          </span>
                          <span className="text-muted-foreground text-[11px]">pada entitas</span>
                          <Badge variant="outline" className="text-[10px]">
                            {log.resource_type}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                          Resource ID: {log.resource_id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0 self-start sm:self-center">
                      <Clock className="h-3 w-3" />
                      <span>{dateStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {/* JSON Metadata Inspector Modal */}
      {activeLogInspect && (
        <Dialog open={!!activeLogInspect} onOpenChange={() => setActiveLogInspect(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Code2 className="w-4 h-4 text-primary" />
                Detail Metadata Log Audit
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[11px] p-2 rounded bg-muted/20 border">
                <div>
                  <span className="text-muted-foreground">Aksi: </span>
                  <span className="font-mono font-semibold">{activeLogInspect.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Aktor: </span>
                  <span className="font-mono">{activeLogInspect.actor_id.substring(0, 8)}...</span>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-1">Payload JSON:</p>
                <pre className="p-3 rounded-lg bg-muted/40 border font-mono text-[11px] overflow-x-auto max-h-60 text-foreground">
                  {JSON.stringify(activeLogInspect.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};