/**
 * Generic HTTP helper for renderer-side cloud/backend calls.
 *
 * The old Tauri build used a Rust-side HTTP proxy. In the current Electron
 * build, Chromium fetch is available directly, so this module keeps the same
 * response shape while using standard fetch underneath.
 */

export interface HostFetchRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeout_secs?: number;
}

export interface HostFetchResponse {
  status: number;
  body: string;
  error?: string;
}

export async function hostFetch(
  request: HostFetchRequest,
): Promise<HostFetchResponse> {
  const controller = new AbortController();
  const timeoutMs = (request.timeout_secs ?? 120) * 1000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: controller.signal,
    });
    const body = await res.text();
    return { status: res.status, body };
  } catch (error) {
    return {
      status: 0,
      body: "",
      error: `Fetch failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function hostFetchJson<T>(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
    signal?: AbortSignal;
  } = {},
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const response = await hostFetch({
    url,
    method: options.method || "GET",
    headers: options.headers || {},
    body: options.body,
    timeout_secs: options.timeout || 120,
  });

  if (response.error) {
    return { ok: false, status: response.status, error: response.error };
  }

  if (response.status >= 200 && response.status < 300) {
    try {
      const data = JSON.parse(response.body) as T;
      return { ok: true, status: response.status, data };
    } catch {
      return {
        ok: false,
        status: response.status,
        error: "Failed to parse JSON response",
      };
    }
  }
  return { ok: false, status: response.status, error: response.body };
}
