import type { ReactNode } from "react";
import { Link } from "react-router";
import type { CollectionLayout, PanelWidth } from "@/types/dashboard";
import { cn } from "@/utils/cn";

export interface CollectionItem {
  key: string;
  /** Si existe, el elemento es un enlace. */
  to?: string;
  /** Icono, punto de estado o número a la izquierda (arriba en cuadros). */
  leading?: ReactNode;
  title: ReactNode;
  /** Dato secundario: fecha, tiempo, proyecto… */
  meta?: ReactNode;
  /** Solo en lista: elemento a la derecha (p. ej. una flecha o una insignia). */
  trailing?: ReactNode;
}

interface ItemCollectionProps {
  items: CollectionItem[];
  layout: CollectionLayout;
  width: PanelWidth;
  label: string;
}

function Wrapper({ to, className, children }: { to?: string; className: string; children: ReactNode }) {
  return to ? (
    <Link to={to} className={cn("pressable", className)}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

/** Muestra los elementos de un panel como lista, cuadros o botones. */
export function ItemCollection({ items, layout, width, label }: ItemCollectionProps) {
  if (layout === "tiles") {
    return (
      <ul aria-label={label} data-layout="tiles" className={cn("grid grid-cols-2 gap-2.5", width === "full" && "sm:grid-cols-3 lg:grid-cols-4")}>
        {items.map((item) => (
          <li key={item.key} className="min-w-0">
            <Wrapper
              to={item.to}
              className={cn(
                "flex h-full flex-col gap-2 rounded-xl border border-line bg-surface-muted p-3 transition-colors",
                item.to && "hover:border-accent/40 hover:bg-accent-soft",
              )}
            >
              {item.leading && <span className="flex">{item.leading}</span>}
              <span className="line-clamp-2 text-[13.5px] font-medium">{item.title}</span>
              {item.meta && <span className="mt-auto truncate text-xs text-ink-muted">{item.meta}</span>}
            </Wrapper>
          </li>
        ))}
      </ul>
    );
  }

  if (layout === "buttons") {
    return (
      <ul aria-label={label} data-layout="buttons" className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.key} className="min-w-0">
            <Wrapper
              to={item.to}
              className={cn(
                "inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] transition-colors",
                item.to && "hover:border-accent/40 hover:bg-accent-soft hover:text-accent",
              )}
            >
              {item.leading && <span className="flex shrink-0 [&_svg]:size-3.5">{item.leading}</span>}
              <span className="truncate font-medium">{item.title}</span>
              {item.meta && <span className="shrink-0 text-xs text-ink-muted">{item.meta}</span>}
            </Wrapper>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul aria-label={label} data-layout="list" className="-mx-2 flex flex-col">
      {items.map((item) => (
        <li key={item.key}>
          <Wrapper
            to={item.to}
            className={cn("flex items-center gap-3 rounded-lg px-2 py-2", item.to && "transition-colors hover:bg-surface-muted")}
          >
            {item.leading && <span className="flex shrink-0">{item.leading}</span>}
            <span className="min-w-0 flex-1 truncate text-[13.5px]">{item.title}</span>
            {item.meta && <span className="shrink-0 text-xs text-ink-muted tabular-nums">{item.meta}</span>}
            {item.trailing}
          </Wrapper>
        </li>
      ))}
    </ul>
  );
}
