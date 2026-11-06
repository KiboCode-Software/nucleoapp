import { useEffect, useRef, type ReactNode } from "react";
import { useNavBarStore } from "@/stores/navbar.store";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/** Altura de la barra compacta (ver NavBar): el título grande "colapsa" al pasar bajo ella. */
const NAV_BAR_HEIGHT = 52;

/**
 * Encabezado con título grande de iOS. Al hacer scroll y salir de la vista, la
 * barra superior translúcida (NavBar) muestra el título en pequeño.
 */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const setNavBar = useNavBarStore((s) => s.set);

  useEffect(() => {
    setNavBar({ title, collapsed: false });
    const el = titleRef.current;
    const root = el?.closest("main");
    if (!el || !root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setNavBar({ collapsed: !entry.isIntersecting }), {
      root,
      rootMargin: `-${NAV_BAR_HEIGHT}px 0px 0px 0px`,
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      setNavBar({ title: null, collapsed: false });
    };
  }, [title, setNavBar]);

  return (
    <header className="mb-8 flex items-end justify-between gap-6 print:hidden">
      <div className="min-w-0">
        {subtitle && <p className="mb-1 text-[13px] font-medium text-ink-muted first-letter:uppercase">{subtitle}</p>}
        <h1 ref={titleRef} className="truncate text-[34px] leading-[1.15] font-bold tracking-[-0.03em]">
          {title}
        </h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
