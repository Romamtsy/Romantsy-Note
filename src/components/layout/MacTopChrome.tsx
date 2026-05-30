import { isHostBridgeAvailable, platform } from "@/lib/host";
import { useEffect, useState, type ReactNode } from "react";

const isMacByNavigator = (): boolean =>
  typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

export function useMacTopChromeEnabled(): boolean {
  const hostBridgeAvailable = isHostBridgeAvailable();
  const [enabled, setEnabled] = useState(() => hostBridgeAvailable && isMacByNavigator());

  useEffect(() => {
    let disposed = false;

    if (!hostBridgeAvailable) {
      setEnabled(false);
      return;
    }

    const syncPlatform = async () => {
      try {
        const os = await platform();
        if (!disposed) setEnabled(os === "darwin");
      } catch (error) {
        console.warn("Failed to detect platform for MacTopChrome:", error);
        if (!disposed) setEnabled(isMacByNavigator());
      }
    };

    void syncPlatform();
    return () => {
      disposed = true;
    };
  }, [hostBridgeAvailable]);

  return enabled;
}

interface MacTopChromeProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function MacTopChrome(_: MacTopChromeProps) {
  return null;
}
