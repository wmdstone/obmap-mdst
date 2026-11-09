import React from "react";
import { VcsSidebarPanel } from "./VcsSidebarPanel";

/**
 * Re-export wrapper untuk panel VCS Sidebar agar konsisten
 * dengan penamaan komponen panel ribbon workspace.
 */
export const VcsPanel: React.FC = () => {
  return <VcsSidebarPanel />;
};

export default VcsPanel;