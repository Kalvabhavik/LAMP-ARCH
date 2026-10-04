"use client";

import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { GameEvent, GameState } from "@/lib/game/state";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type ApiResponse = {
  state: GameState;
  events: GameEvent[];
  [key: string]: unknown;
};

async function accessToken(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Call a quest API route; parses the {ok,...} envelope and throws ApiError. */
export async function api<T extends Record<string, unknown> = ApiResponse>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T & { state?: GameState; events?: GameEvent[] }> {
  const token = await accessToken();
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? (init?.body === undefined ? "GET" : "POST"),
    headers: {
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json = (await res.json().catch(() => null)) as
    | ({ ok: true } & T)
    | { ok: false; error?: { code?: string; message?: string } }
    | null;
  if (!res.ok || !json || json.ok === false) {
    const err = (json as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? `Request failed (${res.status}).`);
  }
  return json as T & { state?: GameState; events?: GameEvent[] };
}

/** Multipart upload with real progress (XHR — fetch cannot report upload progress). */
export function uploadWithProgress<T extends Record<string, unknown> = ApiResponse>(
  path: string,
  formData: FormData,
  onProgress?: (fraction: number) => void,
): Promise<T & { state?: GameState; events?: GameEvent[] }> {
  return accessToken().then(
    (token) =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api${path}`);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
        };
        xhr.onload = () => {
          let json: ({ ok: true } & T) | { ok: false; error?: { code?: string; message?: string } } | null = null;
          try {
            json = JSON.parse(xhr.responseText);
          } catch {
            /* fall through */
          }
          if (xhr.status >= 200 && xhr.status < 300 && json && json.ok !== false) {
            resolve(json as T & { state?: GameState; events?: GameEvent[] });
          } else {
            const err = (json as { error?: { code?: string; message?: string } } | null)?.error;
            reject(
              new ApiError(
                xhr.status || 0,
                err?.code ?? `HTTP_${xhr.status || 0}`,
                err?.message ?? `Request failed (${xhr.status}).`,
              ),
            );
          }
        };
        xhr.onerror = () => reject(new ApiError(0, "NETWORK", "Network error during upload."));
        xhr.ontimeout = () => reject(new ApiError(0, "TIMEOUT", "Upload timed out."));
        xhr.send(formData);
      }),
  );
}
