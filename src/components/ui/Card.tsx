import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";
import { panelColor, surface, usePanelStyle } from "./surface";

interface CardProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  action?: ReactNode;
}

export function Card({ title, action, className, style, children, ...rest }: CardProps) {
  const panelStyle = usePanelStyle();
  const look = surface(panelStyle);
  const compact = panelStyle?.density === "compact";

  return (
    <section
      data-variant={panelStyle?.variant ?? "card"}
      className={cn("rounded-2xl transition-colors", compact ? "p-3.5" : "p-5", look.className, className)}
      style={{ ...look.style, ...style }}
      {...rest}
    >
      {(title || action) && (
        <header className={cn("flex items-center justify-between gap-3", compact ? "mb-2.5" : "mb-4")}>
          {title && (
            <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              {panelStyle?.color && <span className="size-2 rounded-full" style={{ backgroundColor: panelColor(panelStyle) }} />}
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
