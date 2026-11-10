import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/global/ui/dialog";
import { Button } from "@/global/ui/button";
import { Input } from "@/global/ui/input";
import { Label } from "@/global/ui/label";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { ProfileService } from "@/domains/settings/profile/services/ProfileService";
import { Loader2, CheckCircle2, XCircle, Globe, Sparkles } from "lucide-react";
import { toast } from "sonner";

export interface ClaimUsernameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (claimedUsername: string) => void;
}

export const ClaimUsernameModal: React.FC<ClaimUsernameModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { user, refreshProfile } = useAuth();
  const [username, setUsername] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [isClaiming, setIsClaiming] = useState(false);

  // Debounce check ketersediaan username saat diketik
  useEffect(() => {
    if (!username.trim()) {
      setIsAvailable(null);
      setFeedback("");
      setIsChecking(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      const res = await ProfileService.checkUsernameAvailability(username, user?.id);
      setIsChecking(false);
      setIsAvailable(res.available);
      setFeedback(res.available ? "Username tersedia!" : (res.reason || "Username tidak valid"));
    }, 400);

    return () => clearTimeout(timer);
  }, [username, user?.id]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAvailable) return;

    setIsClaiming(true);
    const res = await ProfileService.claimOrUpdateUsername(user.id, username);
    setIsClaiming(false);

    if (res.success) {
      toast.success("Username berhasil dibuat!");
      await refreshProfile();
      onOpenChange(false);
      onSuccess(username.trim().toLowerCase());
    } else {
      toast.error(res.error || "Gagal mengklaim username.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-background border-border shadow-2xl">
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Globe className="w-5 h-5" />
          </div>
          <DialogTitle className="text-xl font-semibold">Tentukan Username Publik Anda</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Catatan publik Anda akan diakses melalui alamat khusus:
            <span className="block mt-1 font-mono text-xs text-foreground bg-muted/60 p-2 rounded border border-border">
              /p/<span className="text-primary font-bold">{username.trim().toLowerCase() || "username"}</span>/vault/catatan
            </span>
            Username ini unik global dan dapat diubah sewaktu-waktu.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleClaim} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="claim-username">Pilih Username</Label>
            <div className="relative">
              <Input
                id="claim-username"
                placeholder="misal: mada-dev"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                className="pr-10 font-mono text-sm"
                maxLength={30}
                autoFocus
              />
              <div className="absolute right-3 top-2.5 text-muted-foreground">
                {isChecking && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {!isChecking && isAvailable === true && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                {!isChecking && isAvailable === false && <XCircle className="w-4 h-4 text-destructive" />}
              </div>
            </div>
            {feedback && (
              <p className={`text-xs ${isAvailable ? "text-emerald-500" : "text-destructive"}`}>
                {feedback}
              </p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isClaiming}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={!isAvailable || isClaiming || isChecking}
              className="gap-2"
            >
              {isClaiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Klaim & Lanjutkan Publikasi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};