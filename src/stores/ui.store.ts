import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface UiState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/**
 * Preferencias de interfaz. Se guardan en localStorage para aplicarlas antes del
 * primer render (ver el script de index.html); la clave debe coincidir con allí.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "light",
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () => get().setTheme(get().theme === "light" ? "dark" : "light"),
    }),
    {
      name: "ddl-ui",
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);
