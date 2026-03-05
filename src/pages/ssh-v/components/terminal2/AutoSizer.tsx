import { useRef, useState, useEffect, type ReactNode } from "react";

interface Size {
  width: number;
  height: number;
}

interface AutoSizerProps {
  children: (size: Size) => ReactNode;
}

/**
 * Lightweight AutoSizer — measures the parent container and passes
 * { width, height } to the render-prop children. Uses ResizeObserver.
 */
export default function AutoSizer({ children }: AutoSizerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev.width === Math.round(width) && prev.height === Math.round(height)
          ? prev
          : { width: Math.round(width), height: Math.round(height) },
      );
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: "100%", height: "100%", overflow: "hidden", flex: 1 }}>
      {size.width > 0 && size.height > 0 && children(size)}
    </div>
  );
}
