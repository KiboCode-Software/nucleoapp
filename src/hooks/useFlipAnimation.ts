import { useLayoutEffect, useRef, type RefObject } from "react";

const DURATION_MS = 280;
const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/**
 * Animación FLIP: cuando cambian de sitio los hijos marcados con `data-flip-id`,
 * se desplazan suavemente desde su posición anterior en lugar de saltar.
 * Se vuelve a medir cada vez que cambia `trigger`.
 */
export function useFlipAnimation(container: RefObject<HTMLElement | null>, trigger: unknown) {
  const previous = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const next = new Map<string, DOMRect>();
    const timers: number[] = [];

    for (const node of root.querySelectorAll<HTMLElement>("[data-flip-id]")) {
      // Se mide sin la transformación de una animación anterior que siga en curso.
      node.style.transition = "";
      node.style.transform = "";
      const rect = node.getBoundingClientRect();
      const id = node.dataset.flipId!;
      next.set(id, rect);

      const before = previous.current.get(id);
      if (!before || reduceMotion) continue;
      const dx = before.left - rect.left;
      const dy = before.top - rect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

      node.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        node.style.transition = `transform ${DURATION_MS}ms ${EASING}`;
        node.style.transform = "";
      });
      timers.push(window.setTimeout(() => (node.style.transition = ""), DURATION_MS + 50));
    }

    previous.current = next;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [container, trigger]);
}
