import { useNavBarStore } from "@/stores/navbar.store";
import { cn } from "@/utils/cn";

/**
 * Barra superior translúcida que aparece al hacer scroll, con el título en pequeño
 * (como las barras de navegación de iOS al colapsar el título grande).
 * Va dentro del contenedor con scroll, fija arriba con `sticky` y altura cero
 * para no empujar el contenido.
 */
export function NavBar() {
  const { title, collapsed } = useNavBarStore();
  return (
    <div className="sticky top-0 z-30 h-0 print:hidden" aria-hidden={!collapsed}>
      <div
        className={cn(
          "material absolute inset-x-0 top-0 flex h-[52px] items-center justify-center border-b border-separator/70 transition-opacity duration-200",
          collapsed && title ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {collapsed && title && <p className="animate-fade truncate px-6 text-[15px] font-semibold tracking-[-0.01em]">{title}</p>}
      </div>
    </div>
  );
}
