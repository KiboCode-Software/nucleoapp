import { create } from "zustand";

interface NavBarState {
  /** Título de la página actual (lo publica su PageHeader). */
  title: string | null;
  /** true cuando el título grande ya salió de la vista al hacer scroll. */
  collapsed: boolean;
  set: (state: Partial<Pick<NavBarState, "title" | "collapsed">>) => void;
}

/** Estado de la barra de navegación compacta, al estilo del título grande de iOS. */
export const useNavBarStore = create<NavBarState>()((set) => ({
  title: null,
  collapsed: false,
  set: (state) => set(state),
}));
