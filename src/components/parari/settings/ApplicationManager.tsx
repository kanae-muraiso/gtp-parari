"use client";

import * as React from "react";

// Stable creator-side entry point for APPLICATION.
// The current implementation is delegated to ApplicationManagerLegacy.tsx.
// ApplicationManagerV3Compat.tsx is temporary and should be removed after
// the behavior-preserving APPLICATION refactor.
// Architecture map: /docs/APPLICATION.md
import ApplicationManagerLegacy, {
  type ApplicationManagerCreatedApplication,
} from "./ApplicationManagerLegacy";
import { useApplicationPaymentUiV3 } from "./ApplicationManagerV3Compat";

export type { ApplicationManagerCreatedApplication };

type ApplicationManagerProps =
  React.ComponentProps<typeof ApplicationManagerLegacy>;

export default function ApplicationManager(
  props: ApplicationManagerProps,
) {
  const rootRef =
    React.useRef<HTMLDivElement | null>(null);

  useApplicationPaymentUiV3(rootRef);

  return (
    <div ref={rootRef}>
      <ApplicationManagerLegacy {...props} />
    </div>
  );
}
