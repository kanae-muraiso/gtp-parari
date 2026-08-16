// apps/tools/parari/src/components/parari/panels/useApplicationSettings.ts
// apps/tools/parari/src/components/parari/panels/useApplicationSettings.ts
// 2026-03-31 JST

/**
 * PART: useApplicationSettings
 * コメント:
 * - APPLICATION 参照ノード用の最小 state
 */

import React from "react";

export type ApplicationSettings = {
  enabled: boolean;
  applicationId: string;
};

type Args = {
  enabled?: boolean;
  applicationId?: string | null;
};

export function useApplicationSettings(args: Args) {
  const [settings, setSettings] = React.useState<ApplicationSettings>({
    enabled: Boolean(args.enabled),
    applicationId: String(args.applicationId ?? "").trim(),
  });

  const patch = React.useCallback((next: Partial<ApplicationSettings>) => {
    setSettings((prev) => ({ ...prev, ...next }));
  }, []);

  const toDbPatch = React.useCallback(() => {
    return {};
  }, []);

  return {
    settings,
    patch,
    toDbPatch,
  };
}
