import { useEffect, useRef, RefObject } from "react";

/**
 * Calls `handler` when a click (or mousedown) happens outside `refs`.
 *
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useClickOutside([ref], () => setOpen(false));
 * ```
 */
export function useClickOutside(
  refs: RefObject<HTMLElement>[],
  handler: (event: MouseEvent | TouchEvent) => void
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    function listener(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      for (const ref of refs) {
        if (ref.current?.contains(target)) return;
      }
      handlerRef.current(event);
    }

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, refs);
}
