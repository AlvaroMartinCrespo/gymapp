/** Peticiones JSON a las rutas `/api/*` de la propia app. */

type RequestOptions = { signal?: AbortSignal; cache?: RequestCache };

/** Respuesta de bajo nivel: lanza si no hay red o el cuerpo no es JSON. Para flujos que distinguen esos casos. */
export async function requestJson(url: string, body: unknown, { signal, cache }: RequestOptions = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
    cache,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- el cuerpo lo valida quien llama
  const result: any = await response.json();
  return { response, result };
}

export type ApiResponse<T> =
  | { ok: true; status: number; data: T }
  // `error` es el mensaje del servidor (o null); `unreachable` indica que no hubo respuesta válida (sin red, cuerpo no JSON o petición cancelada).
  | { ok: false; status: number; error: string | null; unreachable: boolean };

/** POST JSON que nunca lanza: devuelve el resultado o el motivo del fallo. */
export async function postJson<T = unknown>(url: string, body: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  try {
    const { response, result } = await requestJson(url, body, options);
    if (response.ok) return { ok: true, status: response.status, data: result as T };
    return { ok: false, status: response.status, error: typeof result?.error === "string" ? result.error : null, unreachable: false };
  } catch {
    return { ok: false, status: 0, error: null, unreachable: true };
  }
}
