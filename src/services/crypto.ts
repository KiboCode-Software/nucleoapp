/**
 * Cifrado de exportaciones con contraseña, usando solo Web Crypto (sin dependencias):
 * PBKDF2-SHA-256 deriva una clave AES-256-GCM, que además autentica el contenido.
 * Sin la contraseña no hay forma de recuperar los datos: no se guarda en ningún sitio.
 */

export const ENCRYPTED_FORMAT = "ddl-encrypted";
export const DEFAULT_ITERATIONS = 600_000;
export const MIN_PASSWORD_LENGTH = 8;

export interface EncryptedEnvelope {
  /** Nombre del producto incluido en la exportación cifrada. */
  app: string;
  format: typeof ENCRYPTED_FORMAT;
  version: 1;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  cipher: { name: "AES-GCM"; iv: string };
  data: string;
}

export class WrongPasswordError extends Error {
  constructor() {
    super("La contraseña no es correcta o el archivo está dañado.");
    this.name = "WrongPasswordError";
  }
}

const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  return typeof value === "object" && value !== null && (value as { format?: unknown }).format === ENCRYPTED_FORMAT;
}

export async function encryptJson(value: unknown, password: string, iterations = DEFAULT_ITERATIONS): Promise<EncryptedEnvelope> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));

  return {
    app: "Núcleo",
    format: ENCRYPTED_FORMAT,
    version: 1,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: toBase64(salt) },
    cipher: { name: "AES-GCM", iv: toBase64(iv) },
    data: toBase64(ciphertext),
  };
}

export async function decryptJson(envelope: EncryptedEnvelope, password: string): Promise<unknown> {
  const key = await deriveKey(password, fromBase64(envelope.kdf.salt), envelope.kdf.iterations);
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(envelope.cipher.iv) as BufferSource },
      key,
      fromBase64(envelope.data) as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    // AES-GCM falla igual con contraseña incorrecta o datos alterados.
    throw new WrongPasswordError();
  }
}
