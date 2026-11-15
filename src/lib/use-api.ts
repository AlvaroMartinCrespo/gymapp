"use client";

import { useEffect, useState } from "react";

import { postJson } from "@/lib/api";

type State<T> = { key: string; data: T | null; error: string; loginRequired: boolean };

type UseApiOptions = {
  url: string;
  /** Cuerpo JSON de la petición. `null` desactiva la carga (por ejemplo, hasta conocer la fecha de hoy). */
  body: object | null;
  /** Identifica la consulta: cualquier cambio (fecha, periodo, recarga) lanza otra petición y cancela la anterior. */
  queryKey: string;
  errors: {
    /** Mensaje si el servidor responde con error y no da uno propio. */
    http: string;
    /** Mensaje si no hay conexión o la respuesta no es válida. */
    network: string;
  };
  cache?: RequestCache;
};

/**
 * Carga de datos con POST JSON: cancela la petición anterior, ignora respuestas obsoletas y expone
 * `loading`, `error` y `loginRequired` (401). `data` es null mientras carga; `latest` conserva los últimos
 * datos recibidos, útil para no vaciar la pantalla al cambiar de consulta.
 */
export function useApi<T>({ url, body, queryKey, errors, cache }: UseApiOptions) {
  const [state, setState] = useState<State<T>>({ key: "", data: null, error: "", loginRequired: false });
  const payload = body === null ? null : JSON.stringify(body);
  const { http, network } = errors;

  useEffect(() => {
    if (payload === null) return;
    const controller = new AbortController();
    void postJson<T>(url, JSON.parse(payload), { signal: controller.signal, cache }).then((result) => {
      if (controller.signal.aborted) return;
      setState(result.ok
        ? { key: queryKey, data: result.data, error: "", loginRequired: false }
        : { key: queryKey, data: null, error: result.unreachable ? network : result.error ?? http, loginRequired: result.status === 401 });
    });
    return () => controller.abort();
  }, [url, payload, queryKey, http, network, cache]);

  const loading = payload === null || state.key !== queryKey;
  return { data: loading ? null : state.data, latest: state.data, error: state.error, loginRequired: state.loginRequired, loading };
}
