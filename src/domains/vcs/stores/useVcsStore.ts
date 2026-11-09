import { create } from 'zustand';
import { VcsBranch } from '../types/vcs';
import { VcsCloudService } from '../services/VcsCloudService';
import { VcsSyncQueueService } from '../services/VcsSyncQueueService';

interface VcsState {
  activeBranchId: string | null;
  activeBranchName: string;
  branches: VcsBranch[];
  isLoadingBranches: boolean;
  pendingSyncCount: number;
  isProcessingSync: boolean;

  setActiveBranch: (branchId: string, branchName: string) => void;
  loadBranches: (vaultId: string, userId?: string) => Promise<void>;
  updatePendingCount: (count: number) => void;
  setProcessingSync: (processing: boolean) => void;
}

export const useVcsStore = create<VcsState>((set, get) => ({
  activeBranchId: null,
  activeBranchName: 'main',
  branches: [],
  isLoadingBranches: false,
  pendingSyncCount: 0,
  isProcessingSync: false,

  setActiveBranch: (branchId: string, branchName: string) => {
    set({ activeBranchId: branchId, activeBranchName: branchName });
  },

  loadBranches: async (vaultId: string, userId?: string) => {
    set({ isLoadingBranches: true });
    try {
      let branchList = await VcsCloudService.listBranches(vaultId, false);
      if (branchList.length === 0 && userId) {
        const defaultBranch = await VcsCloudService.ensureDefaultBranch(vaultId, userId);
        branchList = [defaultBranch];
      }

      const currentActive = get().activeBranchId;
      const target = branchList.find((b) => b.id === currentActive) ||
                     branchList.find((b) => b.isDefault) ||
                     branchList[0];

      set({
        branches: branchList,
        activeBranchId: target ? target.id : null,
        activeBranchName: target ? target.name : 'main',
      });
    } catch (err) {
      console.warn('Gagal memuat branches:', err);
    } finally {
      set({ isLoadingBranches: false });
    }
  },

  updatePendingCount: (count: number) => set({ pendingSyncCount: count }),
  setProcessingSync: (processing: boolean) => set({ isProcessingSync: processing }),
}));