/**
 * Low-level Electron host bridge. Exposes `invoke`, `listen`, `Channel`,
 * `Resource`, `transformCallback`, and availability checks to
 * `src/lib/host.ts`, which re-exports them to the rest of the renderer.
 */

export const SERIALIZE_TO_IPC_FN = "__TAURI_TO_IPC_KEY__";

export type InvokeArgs = Record<string, unknown>;

export type HostBridgeInternals = {
  invoke?: <T = unknown>(
    cmd: string,
    args?: Record<string, unknown>,
    options?: unknown,
  ) => Promise<T>;
  listen?: <T = unknown>(
    event: string,
    handler: (event: { event: string; id: number; payload: T }) => void,
  ) => Promise<() => void>;
  transformCallback?: (
    callback: (...args: unknown[]) => unknown,
    once?: boolean,
  ) => number;
};

declare global {
  interface Window {
    __HOST_INTERNALS__?: HostBridgeInternals;
    /** @deprecated legacy Electron migration bridge name */
    __TAURI_INTERNALS__?: HostBridgeInternals;
    /** @deprecated legacy Electron migration bridge name */
    __TAURI__?: {
      core?: { invoke?: HostBridgeInternals["invoke"] };
    };
  }
}

function getInternals(): HostBridgeInternals | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__HOST_INTERNALS__ ?? window.__TAURI_INTERNALS__;
}

function getInvoke() {
  const fn =
    getInternals()?.invoke ??
    (typeof window !== "undefined" ? window.__TAURI__?.core?.invoke : undefined);
  if (typeof fn !== "function") {
    throw new Error("Host invoke bridge unavailable");
  }
  return fn;
}

export function isHostBridgeAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof getInternals()?.invoke === "function" ||
    typeof window.__TAURI__?.core?.invoke === "function"
  );
}

/** @deprecated Use isHostBridgeAvailable. */
export function isTauri(): boolean {
  return isHostBridgeAvailable();
}

export async function invoke<T = unknown>(
  cmd: string,
  args: InvokeArgs = {},
  options?: unknown,
): Promise<T> {
  return getInvoke()(cmd, args, options) as Promise<T>;
}

export function transformCallback<T = unknown>(
  callback?: (response: T) => void,
  once = false,
): number {
  const transform = getInternals()?.transformCallback;
  if (typeof transform === "function") {
    return transform((response: unknown) => callback?.(response as T), once);
  }
  return -1;
}

export class Channel<T = unknown> {
  id: number;
  #onmessage: (message: T) => void;

  constructor(onmessage?: (message: T) => void) {
    this.#onmessage = onmessage ?? (() => {});
    this.id = transformCallback((message: T) => {
      this.#onmessage(message);
    });
  }

  set onmessage(handler: (message: T) => void) {
    this.#onmessage = handler;
  }

  get onmessage() {
    return this.#onmessage;
  }

  [SERIALIZE_TO_IPC_FN]() {
    return `__CHANNEL__:${this.id}`;
  }

  toJSON() {
    return this[SERIALIZE_TO_IPC_FN]();
  }
}

export class Resource {
  #rid: number;

  constructor(rid: number) {
    this.#rid = rid;
  }

  get rid() {
    return this.#rid;
  }

  async close(): Promise<void> {
    await invoke("plugin:resources|close", { rid: this.#rid }).catch(() => {});
  }
}

// ── Event bridge ───────────────────────────────────────────────────────────

export type UnlistenFn = () => void;

export async function listen<T>(
  event: string,
  handler: (event: { event: string; id: number; payload: T }) => void,
): Promise<UnlistenFn> {
  const bridge = getInternals();
  if (!bridge?.listen) {
    throw new Error("Host event bridge unavailable");
  }
  return bridge.listen!(
    event,
    handler as (e: { event: string; id: number; payload: unknown }) => void,
  );
}

// ── App metadata ───────────────────────────────────────────────────────────

export async function getVersion(): Promise<string> {
  return invoke<string>("get_version");
}

export const isTauriAvailable = isHostBridgeAvailable;
export type TauriInternals = HostBridgeInternals;
