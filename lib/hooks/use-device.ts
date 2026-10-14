"use client";

import { useEffect, useState } from "react";

export function useDevice() {
  const [device, setDevice] = useState<{ isMac: boolean; isWindows: boolean; isLinux: boolean }>({
    isMac: false,
    isWindows: false,
    isLinux: false,
  });

  useEffect(() => {
    const platform = navigator.platform ?? "";
    const ua = navigator.userAgent ?? "";
    const isMac = /Mac|iPhone|iPad/.test(platform) || /Mac/i.test(ua);
    const isWindows = /Win/.test(platform);
    const isLinux = /Linux/.test(platform) && !isMac;
    setDevice({ isMac, isWindows, isLinux });
  }, []);

  return device;
}
