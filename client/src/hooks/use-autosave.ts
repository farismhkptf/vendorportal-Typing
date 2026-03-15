import { useState, useEffect, useRef, useCallback } from "react";
import type { SaveStatus } from "@/components/ui/save-status";

interface UseAutosaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

export function useAutosave<T>({
  data,
  onSave,
  debounceMs = 1500,
  enabled = true,
}: UseAutosaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const isInitializedRef = useRef(false);
  const pendingDataRef = useRef<T>(data);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const serialized = JSON.stringify(data);

  useEffect(() => {
    if (!isInitializedRef.current) {
      lastSavedRef.current = serialized;
      isInitializedRef.current = true;
      return;
    }
  }, [serialized]);

  const doSave = useCallback(async (saveData: T) => {
    const snap = JSON.stringify(saveData);
    if (snap === lastSavedRef.current) return;

    setStatus("saving");
    try {
      await onSave(saveData);
      if (isMountedRef.current) {
        lastSavedRef.current = snap;
        setStatus("saved");
      }
    } catch {
      if (isMountedRef.current) {
        setStatus("error");
      }
    }
  }, [onSave]);

  const retry = useCallback(() => {
    doSave(pendingDataRef.current);
  }, [doSave]);

  useEffect(() => {
    pendingDataRef.current = data;

    if (!enabled || !isInitializedRef.current) return;
    if (serialized === lastSavedRef.current) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      doSave(data);
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [serialized, enabled, debounceMs, doSave, data]);

  const isDirty = serialized !== lastSavedRef.current;

  useEffect(() => {
    if (!enabled || !isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      if (status === "saving" || isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled, isDirty, status]);

  const resetBaseline = useCallback((newData: T) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const snap = JSON.stringify(newData);
    lastSavedRef.current = snap;
    pendingDataRef.current = newData;
    isInitializedRef.current = true;
    setStatus("idle");
  }, []);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const current = JSON.stringify(pendingDataRef.current);
    if (current !== lastSavedRef.current) {
      await doSave(pendingDataRef.current);
    }
  }, [doSave]);

  return { status, isDirty, retry, resetBaseline, flush };
}
