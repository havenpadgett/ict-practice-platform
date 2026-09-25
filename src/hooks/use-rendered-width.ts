"use client";

import { useEffect, useState, type RefObject } from "react";

/** The element's rendered CSS width, kept current with a ResizeObserver —
 * lets an SVG size its viewBox to the screen so text stays at real pixel
 * size on a phone. Null until measured. */
export function useRenderedWidth(ref: RefObject<Element | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      setWidth((prev) => (prev === w ? prev : w));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
