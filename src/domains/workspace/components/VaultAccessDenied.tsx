import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useWorkspaceStore } from "@/domains/workspace/stores/useWorkspaceStore";

export function VaultAccessDenied() {
  const openView = useWorkspaceStore((s) => s.openView);

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-background/95 text-center">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4 ring-8 ring-destructive/5">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Akses Vault Ditolak
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
        Anda tidak memiliki izin (Superadmin, Pemilik, Kontributor, atau Viewer) untuk melihat isi ruang kerja vault ini.
      </p>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => openView({ type: "settings", title: "Pengaturan" })}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Buka Pengaturan Vault
        </Button>
      </div>
    </div>
  );
}
