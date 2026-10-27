"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ADDED_FLASH_MS = 1800;

export type AddStatus = "idle" | "adding" | "added";

// Drives an add-to-cart button's label: idle -> adding -> added (briefly) -> idle.
// `run` takes the add action, which resolves true when the item was added.
export function useAddFeedback() {
  const [status, setStatus] = useState<AddStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const run = useCallback(async (add: () => Promise<boolean>) => {
    if (timer.current) clearTimeout(timer.current);
    setStatus("adding");
    const ok = await add();
    if (!ok) {
      setStatus("idle");
      return false;
    }
    setStatus("added");
    timer.current = setTimeout(() => setStatus("idle"), ADDED_FLASH_MS);
    return true;
  }, []);

  return { status, run };
}
