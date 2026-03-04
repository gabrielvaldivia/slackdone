"use client";

import { ReactNode } from "react";
import {
  useFloating,
  autoUpdate,
  flip,
  shift,
  offset,
  FloatingPortal,
  useClick,
  useDismiss,
  useInteractions,
} from "@floating-ui/react";

interface FloatingDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
}

export default function FloatingDropdown({
  open,
  onOpenChange,
  trigger,
  children,
}: FloatingDropdownProps) {
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    placement: "bottom-start",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context, { toggle: true });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  return (
    <>
      <div ref={refs.setReference} {...getReferenceProps()}>
        {trigger}
      </div>
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {children}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
