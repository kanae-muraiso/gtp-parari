"use client";

import { useEffect } from "react";

import {
  type ParariWorkspace,
  recordParariWorkspaceVisit,
} from "@/lib/parariWorkspace";

type WorkspaceVisitTrackerProps = {
  workspace: ParariWorkspace;
};

export default function WorkspaceVisitTracker({
  workspace,
}: WorkspaceVisitTrackerProps) {
  useEffect(() => {
    void recordParariWorkspaceVisit(workspace);
  }, [workspace]);

  return null;
}
