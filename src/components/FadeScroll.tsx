"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface FadeScrollProps {
  children: React.ReactNode;
  className?: string;
}

export default function FadeScroll({ children, className = "" }: FadeScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const left = canScrollLeft ? "transparent, black 24px" : "black, black";
  const right = canScrollRight ? "black calc(100% - 24px), transparent" : "black, black";
  const mask = `linear-gradient(to right, ${left}, ${right})`;

  return (
    <div
      ref={ref}
      className={`overflow-x-auto scrollbar-none ${className}`}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </div>
  );
}
