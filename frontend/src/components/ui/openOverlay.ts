import { useEffect, useRef } from "react";

type OverlayCloser = () => void;

let activeOverlay: { id: number; close: OverlayCloser } | null = null;
let nextOverlayId = 0;

export function useExclusiveOverlay(open: boolean, close: OverlayCloser) {
  const idRef = useRef<number>(0);
  const closeRef = useRef(close);
  closeRef.current = close;

  if (!idRef.current) {
    idRef.current = ++nextOverlayId;
  }

  useEffect(() => {
    if (open) {
      if (activeOverlay && activeOverlay.id !== idRef.current) {
        activeOverlay.close();
      }
      activeOverlay = {
        id: idRef.current,
        close: () => closeRef.current(),
      };
      return;
    }

    if (activeOverlay?.id === idRef.current) {
      activeOverlay = null;
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (activeOverlay?.id === idRef.current) {
        activeOverlay = null;
      }
    };
  }, []);
}
