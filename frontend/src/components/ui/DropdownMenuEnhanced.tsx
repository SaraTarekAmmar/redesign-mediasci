import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DropdownMenu as BaseDropdownMenu,
  DropdownMenuTrigger as BaseDropdownMenuTrigger,
  DropdownMenuContent as BaseDropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "../ui/DropdownMenu";
import { useExclusiveOverlay } from "./openOverlay";

// The generated design-system primitive renders its content as a plain
// `absolute` div with no portal, so it gets clipped by any ancestor with
// `overflow-hidden` (e.g. the sidebar) and never actually reads `align`.
// It also has no outside-click handling. This wrapper fixes both by
// portaling the content to <body> and positioning it from the trigger's
// bounding rect, without touching the generated bundle.
const DropdownCtx = createContext<{
  triggerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

export function DropdownMenu({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (value: boolean) => {
      onOpenChange?.(value);
      if (!isControlled) setInternalOpen(value);
    },
    [onOpenChange, isControlled]
  );

  useExclusiveOverlay(isOpen, () => setOpen(false));

  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const stableRefs = useRef({ triggerRef, contentRef }).current;
  const ctx = { ...stableRefs, open: isOpen, setOpen };

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || contentRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen, setOpen]);

  return (
    <BaseDropdownMenu open={isOpen} onOpenChange={setOpen}>
      <DropdownCtx.Provider value={ctx}>
        <div className="relative inline-block">{children}</div>
      </DropdownCtx.Provider>
    </BaseDropdownMenu>
  );
}

export function DropdownMenuTrigger({
  children,
  asChild,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
}) {
  const ctx = useContext(DropdownCtx);

  // The generated primitive always renders its own <button>, so asChild=true
  // with a <Button> child would nest <button> inside <button> (invalid HTML,
  // React warns). Bypass it here and wire the click/ref onto the child directly.
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref: ctx?.triggerRef,
      onClick: (e: React.MouseEvent) => {
        (children as any).props.onClick?.(e);
        ctx?.setOpen(!ctx.open);
      },
    });
  }

  return (
    <BaseDropdownMenuTrigger ref={ctx?.triggerRef as any} className={className} {...props}>
      {children}
    </BaseDropdownMenuTrigger>
  );
}

export function DropdownMenuContent({
  children,
  className,
  align = "start",
  sideOffset = 4,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}) {
  const ctx = useContext(DropdownCtx);
  const [position, setPosition] = useState<React.CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    const trigger = ctx?.triggerRef.current;
    const content = ctx?.contentRef.current;
    if (!ctx?.open || !trigger || !content) return;

    const update = () => {
      const rect = trigger.getBoundingClientRect();
      const width = content.offsetWidth;
      let left = align === "end" ? rect.right - width : align === "center" ? rect.left + rect.width / 2 - width / 2 : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      setPosition({ position: "fixed", top: rect.bottom + sideOffset, left, visibility: "visible" });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [align, sideOffset, ctx?.open]);

  if (!ctx) return null;

  return createPortal(
    <BaseDropdownMenuContent
      ref={ctx.contentRef as any}
      className={className}
      style={{ ...position, ...style }}
      {...props}
    >
      {children}
    </BaseDropdownMenuContent>,
    document.body
  );
}

export {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
};
