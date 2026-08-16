import React, { useCallback, useState } from "react";
import {
  Popover as BasePopover,
  PopoverTrigger as BasePopoverTrigger,
  PopoverContent as BasePopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "../../_designSystem/ds-6551b66a-cfd3-4df9-a9b1-9ead8d7fe7e9";
import { useExclusiveOverlay } from "./openOverlay";

export function Popover({
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

  return (
    <BasePopover open={isOpen} onOpenChange={setOpen}>
      <div className="relative inline-block">{children}</div>
    </BasePopover>
  );
}

export function PopoverTrigger({
  children,
  asChild: _asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
}) {
  return (
    <BasePopoverTrigger {...props}>
      {children}
    </BasePopoverTrigger>
  );
}

export function PopoverContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <BasePopoverContent className={className} {...props}>
      {children}
    </BasePopoverContent>
  );
}

export { PopoverHeader, PopoverTitle, PopoverDescription };
