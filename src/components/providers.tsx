"use client";

import { ReactNode, useEffect } from "react";
import { useStore } from "@/lib/store";

function DatabaseLoader({ children }: { children: ReactNode }) {
  const user = useStore((s) => s.user);
  const loadFromDb = useStore((s) => s.loadFromDb);

  useEffect(() => {
    if (user) {
      loadFromDb().catch(() => {});
    }
  }, [user, loadFromDb]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return <DatabaseLoader>{children}</DatabaseLoader>;
}
