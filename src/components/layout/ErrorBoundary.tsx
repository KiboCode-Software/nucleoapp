import { TriangleAlert } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

interface ErrorBoundaryProps {
  /** Al cambiar (p. ej. la ruta), se vuelve a intentar mostrar el contenido. */
  resetKey: unknown;
  children: ReactNode;
}

/** Si un módulo falla al mostrarse, enseña un aviso en lugar de dejar la ventana en blanco. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error al mostrar el módulo", error, info.componentStack);
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
          <TriangleAlert className="size-5" />
        </span>
        <p className="text-[15px] font-semibold">Algo falló al mostrar esta pantalla</p>
        <p className="text-[13px] text-ink-muted">Tus datos están a salvo. Prueba de nuevo; si se repite, cuéntanos qué estabas haciendo.</p>
        <code className="max-w-full truncate rounded-md bg-surface-muted px-2 py-1 text-xs text-ink-muted">{this.state.error.message}</code>
        <Button variant="secondary" onClick={() => this.setState({ error: null })}>
          Reintentar
        </Button>
      </div>
    );
  }
}
