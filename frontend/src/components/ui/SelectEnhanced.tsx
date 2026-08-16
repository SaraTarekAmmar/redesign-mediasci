import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Select as BaseSelect,
  SelectTrigger as BaseSelectTrigger,
  SelectContent as BaseSelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "../ui/Select";
import { useExclusiveOverlay } from "./openOverlay";

const SelectCtx = createContext<{ value?: string; labels: Map<string, React.ReactNode> }>({ value: undefined, labels: new Map() });

function collectItemLabels(children: React.ReactNode, map: Map<string, React.ReactNode>) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as any;
    if (child.type === SelectItem) {
      map.set(String(props.value), props.children);
    } else if (props?.children) {
      collectItemLabels(props.children, map);
    }
  });
}

export function Select({
  children,
  value,
  defaultValue,
  onValueChange,
  open: controlledOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback((value: boolean) => {
    onOpenChange?.(value);
    if (!isControlled) {
      setInternalOpen(value);
    }
  }, [isControlled, onOpenChange]);

  // The generated Select primitive manages its own open/closed state
  // internally and never calls onOpenChange — controlling it via React state
  // is a no-op. The only way to close it is to click its trigger again, and
  // the only way to know it's open is to check the trigger's aria-expanded
  // attribute directly in the DOM. So this listener is always attached (not
  // gated on any React state) and only acts when the DOM says it's open.
  useExclusiveOverlay(isOpen, () => {
    const trigger = containerRef.current?.querySelector<HTMLElement>('[data-slot="select-trigger"]');
    if (trigger?.getAttribute("aria-expanded") === "true") trigger.click();
  });

  useEffect(() => {
    const closeIfOpen = () => {
      const trigger = containerRef.current?.querySelector<HTMLElement>('[data-slot="select-trigger"]');
      if (trigger?.getAttribute("aria-expanded") === "true") trigger.click();
    };
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      closeIfOpen();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeIfOpen();
    };
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  const labels = useMemo(() => {
    const map = new Map<string, React.ReactNode>();
    collectItemLabels(children, map);
    return map;
  }, [children]);

  return (
    <BaseSelect
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      open={isOpen}
      onOpenChange={setOpen}>
      <SelectCtx.Provider value={{ value, labels }}>
        <div ref={containerRef} className="relative inline-block">{children}</div>
      </SelectCtx.Provider>
    </BaseSelect>
  );
}

// The generated SelectValue just prints the raw value instead of the matching
// SelectItem's label, so render our own using the value → label map from context.
export function SelectValue({ placeholder }: { placeholder?: React.ReactNode }) {
  const { value, labels } = useContext(SelectCtx);
  const label = value !== undefined ? labels.get(String(value)) : undefined;
  return <span data-slot="select-value">{label ?? (value ? value : placeholder)}</span>;
}

export function SelectTrigger({
  children,
  className,
  size = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "default" | "sm";
}) {
  return (
    <BaseSelectTrigger size={size} className={className} {...props}>
      {children}
    </BaseSelectTrigger>
  );
}

export function SelectContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <BaseSelectContent className={className} {...props}>
      {children}
    </BaseSelectContent>
  );
}

export { SelectItem, SelectGroup, SelectLabel };
