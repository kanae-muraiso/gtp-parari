"use client";

import * as React from "react";

// Stable creator-side entry point for APPLICATION.
// The implementation is delegated to ApplicationManagerLegacy.tsx.
// Architecture map: /docs/APPLICATION.md
import ApplicationManagerLegacy, {
  type ApplicationManagerCreatedApplication,
} from "./ApplicationManagerLegacy";

export type { ApplicationManagerCreatedApplication };

type ApplicationManagerProps =
  React.ComponentProps<typeof ApplicationManagerLegacy>;

export default function ApplicationManager(
  props: ApplicationManagerProps,
) {
  return (
    <ApplicationManagerLegacy {...props} />
  );
}
