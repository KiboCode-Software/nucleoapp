import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppRoutes } from "@/App";
import { LockScreen } from "@/components/shell/LockScreen";
import { useAutoLock } from "@/hooks/useAutoLock";
import { securityApi } from "@/services/security";
import { useLockStore } from "@/stores/lock.store";

/** En las pruebas no hay Tauri: el código vive en memoria (createMemorySecurityApi). */
let pin: string | null = null;

async function setTestPin(code: string | null) {
  if (pin) await securityApi.disablePin(pin);
  if (code) await securityApi.setPin(null, code);
  pin = code;
  useLockStore.setState({ status: "idle", security: null, locked: false });
  await useLockStore.getState().load();
}

const press = (digits: string) => {
  for (const digit of digits) fireEvent.click(screen.getByRole("button", { name: digit }));
};

beforeEach(() => setTestPin(null));
afterEach(cleanup);

describe("pantalla de bloqueo", () => {
  it("con código, la app arranca bloqueada y se desbloquea con el código correcto", async () => {
    await setTestPin("1234");
    expect(useLockStore.getState().locked).toBe(true);
    render(<LockScreen />);

    expect(screen.getByRole("dialog", { name: "App bloqueada" })).toHaveTextContent("Introduce el código");
    press("1235");
    expect(await screen.findByText("1 intento fallido")).toBeInTheDocument();
    expect(useLockStore.getState().locked).toBe(true);

    await waitFor(() => expect(screen.getByRole("status", { name: "0 de 4 dígitos" })).toBeInTheDocument());
    press("1234");
    await waitFor(() => expect(useLockStore.getState().locked).toBe(false));
  });

  it("acepta el teclado físico y borra con Retroceso", async () => {
    await setTestPin("2580");
    render(<LockScreen />);
    for (const key of ["2", "5", "9", "Backspace", "8", "0"]) fireEvent.keyDown(window, { key });
    await waitFor(() => expect(useLockStore.getState().locked).toBe(false));
  });

  it("durante una espera tras varios fallos el teclado no admite intentos", async () => {
    await setTestPin("1234");
    useLockStore.setState((s) => ({ security: { ...s.security!, failed: 5, locked_until: Date.now() + 60_000 } }));
    render(<LockScreen />);
    expect(screen.getByText("Inténtalo de nuevo en 1 minuto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1" })).toBeDisabled();
  });

  it("sin código no se bloquea, ni siquiera con Ctrl+L", async () => {
    function Probe() {
      useAutoLock();
      return null;
    }
    render(<Probe />);
    fireEvent.keyDown(window, { key: "l", ctrlKey: true });
    expect(useLockStore.getState().locked).toBe(false);

    await act(() => setTestPin("1234"));
    useLockStore.getState().unlock();
    fireEvent.keyDown(window, { key: "l", ctrlKey: true });
    expect(useLockStore.getState().locked).toBe(true);
  });
});

describe("Ajustes · Código y Windows Hello", () => {
  const renderSettings = () =>
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

  it("activa un código de 6 dígitos pidiéndolo dos veces", async () => {
    renderSettings();
    fireEvent.click(await screen.findByRole("button", { name: "Activar código" }));
    const sheet = await screen.findByRole("dialog", { name: "Activar código" });
    expect(sheet).toHaveTextContent("Introduce un código nuevo");

    press("135790");
    expect(await within(sheet).findByText("Vuelve a introducir el código")).toBeInTheDocument();
    press("111111");
    // No coinciden: se vuelve a elegir.
    expect(await within(sheet).findByText("Los códigos no coinciden. Inténtalo de nuevo.")).toBeInTheDocument();
    press("135790");
    await within(sheet).findByText("Vuelve a introducir el código");
    press("135790");

    expect(await screen.findByText("Código activado. Se pedirá al abrir la app.")).toBeInTheDocument();
    expect(useLockStore.getState().security).toMatchObject({ enabled: true, length: 6 });
    pin = "135790";
    expect(screen.getByRole("button", { name: "Bloquear la app" })).toBeInTheDocument();
  });

  it("cambia a un código de 4 dígitos y lo desactiva pidiendo el actual", async () => {
    await setTestPin("123456");
    useLockStore.getState().unlock();
    renderSettings();

    fireEvent.click(await screen.findByRole("button", { name: "Cambiar" }));
    press("123456");
    fireEvent.click(await screen.findByRole("button", { name: "Usar un código de 4 dígitos" }));
    press("4321");
    await screen.findByText("Vuelve a introducir el código");
    press("4321");
    expect(await screen.findByText("Código cambiado.")).toBeInTheDocument();
    pin = "4321";
    expect(useLockStore.getState().security?.length).toBe(4);

    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    press("0000");
    expect(await screen.findByText("Código incorrecto")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status", { name: "0 de 4 dígitos" })).toBeInTheDocument());
    press("4321");
    expect(await screen.findByText("Código desactivado.")).toBeInTheDocument();
    pin = null;
    expect(useLockStore.getState().security?.enabled).toBe(false);
  });

  it("Windows Hello queda desactivado si el equipo no lo tiene", async () => {
    await setTestPin("1234");
    useLockStore.getState().unlock();
    renderSettings();
    expect(await screen.findByRole("switch", { name: "Desbloquear con Windows Hello" })).toBeDisabled();
    expect(screen.getByText(/No disponible en este equipo/)).toBeInTheDocument();
  });
});
