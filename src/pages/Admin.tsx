import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSuperadminGuard } from "@/domains/admin/hooks/useSuperadminGuard";
import { AdminService } from "@/domains/admin/services/AdminService";
import type { UserWithRole, SystemMetrics, SystemTelemetryContract } from "@/types/admin";
import type { AuditLogRecord } from "@/types/collaboration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/global/ui/tabs";
import { Button } from "@/global/ui/button";
import { Badge } from "@/global/ui/badge";
import { FirstTimeSetupWizard } from "@/domains/admin/components/FirstTimeSetupWizard";
import { UserManagementTab } from "@/domains/admin/components/UserManagementTab";
import { HealthMetricsTab } from "@/domains/admin/components/HealthMetricsTab";
import { AuditFeedTab } from "@/domains/admin/components/AuditFeedTab";
import { SystemArchitectureTab } from "@/domains/admin/components/SystemArchitectureTab";
import {
  ShieldCheck,
  Users,
  Activity,
  Layers,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Database,
} from "lucide-react";

export const AdminPage: React.FC = () => {
  const { isAuthorized, needsSetup, loading: guardLoading } = useSuperadminGuard();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [telemetry, setTelemetry] = useState<SystemTelemetryContract | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const loadAllAdminData = async () => {
    setLoadingData(true);
    const [uData, mData, aData] = await Promise.all([
      AdminService.getUsersWithRoles(),
      AdminService.getSystemMetrics(),
      AdminService.getAuditLogs(100),
    ]);

    setUsers(uData);
    setMetrics(mData);
    setAuditLogs(aData);
    setTelemetry(AdminService.getSystemTelemetry());
    setLoadingData(false);
  };

  useEffect(() => {
    if (isAuthorized && !needsSetup) {
      loadAllAdminData();
    }
  }, [isAuthorized, needsSetup]);

  if (guardLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Memverifikasi hak akses Superadmin...</p>
        </div>
      </div>
    );
  }

  // Jika sistem belum memiliki Superadmin perdana, tampilkan Setup Wizard
  if (needsSetup) {
    return <FirstTimeSetupWizard onClaimed={loadAllAdminData} />;
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navbar Cockpit */}
      <header className="border-b bg-card sticky top-0 z-30 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/app")}
            className="text-xs gap-1.5 h-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Workspace
          </Button>
          <div className="h-4 w-[1px] bg-border" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight leading-none">Superadmin Cockpit</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">ObMap Knowledge Ecosystem</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Badge Ping Supabase Cloud */}
          <Badge variant="outline" className="hidden sm:flex text-[11px] items-center gap-1.5 py-1 px-2.5">
            <Database className="w-3 h-3 text-emerald-500" />
            <span>Supabase Cloud:</span>
            <span className="font-mono text-emerald-600 font-semibold">{metrics?.dbPingMs ?? "..."} ms</span>
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={loadAllAdminData}
            disabled={loadingData}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`h-3 w-3 ${loadingData ? "animate-spin" : ""}`} />
            Segarkan
          </Button>
        </div>
      </header>

      {/* Main Container dengan Tabs Navigation */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full sm:w-[580px]">
            <TabsTrigger value="users" className="text-xs gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Pengguna
            </TabsTrigger>
            <TabsTrigger value="health" className="text-xs gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Kesehatan
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Jejak Audit
            </TabsTrigger>
            <TabsTrigger value="architecture" className="text-xs gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Arsitektur
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="outline-none">
            <UserManagementTab users={users} onRefresh={loadAllAdminData} />
          </TabsContent>

          <TabsContent value="health" className="outline-none">
            <HealthMetricsTab metrics={metrics} auditLogs={auditLogs} />
          </TabsContent>

          <TabsContent value="audit" className="outline-none">
            <AuditFeedTab auditLogs={auditLogs} />
          </TabsContent>

          <TabsContent value="architecture" className="outline-none">
            {telemetry && <SystemArchitectureTab telemetry={telemetry} />}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPage;