import { create } from "zustand";

interface StatusNoticeState {
  notice: string | null;
  setNotice: (message: string, durationMs?: number) => void;
  clearNotice: () => void;
}

let noticeTimeout: ReturnType<typeof setTimeout> | null = null;

export const useStatusNoticeStore = create<StatusNoticeState>((set) => ({
  notice: null,
  setNotice: (message: string, durationMs = 3500) => {
    if (noticeTimeout) clearTimeout(noticeTimeout);
    set({ notice: message });

    noticeTimeout = setTimeout(() => {
      set({ notice: null });
      noticeTimeout = null;
    }, durationMs);
  },
  clearNotice: () => {
    if (noticeTimeout) clearTimeout(noticeTimeout);
    set({ notice: null });
  },
}));