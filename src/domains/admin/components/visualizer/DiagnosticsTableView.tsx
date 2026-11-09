import React, { useState } from "react";
import type { SystemTelemetryContract } from "@/types/admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Table as TableIcon, Search, AlertTriangle, Info, XCircle } from "lucide-react";

interface Props {
  telemetry: SystemTelemetryContract;
}

export const DiagnosticsTableView: React.FC<Props> = ({ telemetry }) => {
  const [search, setSearch] = useState("");

  const filteredDiagnostics = telemetry.diagnostics.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.subsystem.toLowerCase().includes(q) ||
      d.message.toLowerCase().includes(q) ||
      d.severity.toLowerCase().includes(q)
    );
  });

  return (
    <Card className="bg-card">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TableIcon className="h-4 w-4 text-primary" />
            Tabel Diagnostik Sistem Mendalam (Deep Diagnostics)
          </CardTitle>
          <CardDescription className="text-xs">
            Log telemetri internal untuk analisis performa, isolasi bug, dan kepatuhan sistem.
          </CardDescription>
        </div>
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Cari log atau modul..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tingkat</TableHead>
                <TableHead>Subsistem</TableHead>
                <TableHead>Pesan Diagnostik</TableHead>
                <TableHead className="text-right">Waktu Catat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDiagnostics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs">
                    Tidak ada catatan diagnostik yang cocok.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDiagnostics.map((d) => {
                  const dateStr = new Date(d.timestamp).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        {d.severity === "error" ? (
                          <Badge variant="destructive" className="text-[10px] flex items-center gap-1 w-fit">
                            <XCircle className="h-3 w-3" />
                            Error
                          </Badge>
                        ) : d.severity === "warning" ? (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] flex items-center gap-1 w-fit">
                            <AlertTriangle className="h-3 w-3" />
                            Warning
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] flex items-center gap-1 w-fit">
                            <Info className="h-3 w-3" />
                            Info
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {d.subsystem}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        {d.message}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {dateStr}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};