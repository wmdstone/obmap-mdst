import { useCallback, useMemo } from "react";
import { useUIStore } from "@/shared/stores";

export function useFolderNavigation() {
  const expandedFolderIds = useUIStore((state) => state.expandedFolderIds);
  const setExpandedFolderIds = useUIStore((state) => state.setExpandedFolderIds);

  const expandedFolders = useMemo(
    () => new Set(expandedFolderIds),
    [expandedFolderIds]
  );

  const isFolderExpanded = useCallback(
    (folderId: string) => expandedFolders.has(folderId),
    [expandedFolders]
  );

  const toggleFolder = useCallback(
    (folderId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setExpandedFolderIds(
        expandedFolders.has(folderId)
          ? expandedFolderIds.filter((id) => id !== folderId)
          : [...expandedFolderIds, folderId]
      );
    },
    [expandedFolderIds, expandedFolders, setExpandedFolderIds]
  );

  const expandFolder = useCallback(
    (folderId: string) => {
      if (!expandedFolders.has(folderId)) {
        setExpandedFolderIds([...expandedFolderIds, folderId]);
      }
    },
    [expandedFolderIds, expandedFolders, setExpandedFolderIds]
  );

  const collapseFolder = useCallback(
    (folderId: string) => {
      if (expandedFolders.has(folderId)) {
        setExpandedFolderIds(expandedFolderIds.filter((id) => id !== folderId));
      }
    },
    [expandedFolderIds, expandedFolders, setExpandedFolderIds]
  );

  const expandAll = useCallback(
    (folderIds: string[]) => {
      if (!folderIds || folderIds.length === 0) return;

      const current = useUIStore.getState().expandedFolderIds;
      const currentSet = new Set(current);

      // Cari folder yang BELUM terbuka
      const missing = folderIds.filter((id) => !currentSet.has(id));

      // Jika semuanya sudah terbuka, JANGAN panggil setState (mencegah loop re-render!)
      if (missing.length === 0) return;

      setExpandedFolderIds([...current, ...missing]);
    },
    [setExpandedFolderIds] // Referensi stabil permanen
  );

  const collapseAll = useCallback(() => {
    setExpandedFolderIds([]);
  }, [setExpandedFolderIds]);

  return {
    expandedFolderIds,
    expandedFolders,
    isFolderExpanded,
    toggleFolder,
    expandFolder,
    collapseFolder,
    expandAll,
    collapseAll,
  };
}