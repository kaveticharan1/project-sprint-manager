export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(
  /\/$/,
  "",
);

export interface ApiErrorDetails {
  fields?: Record<string, string>;
  task_count?: number;
  open_task_count?: number;
  sprint_count?: number;
  task_numbers?: string[];
  [key: string]: unknown;
}

/** Error thrown for any non-2xx response, carrying the API's {code, message, details}. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: ApiErrorDetails = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  get fields(): Record<string, string> {
    return this.details.fields ?? {};
  }
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];

export function toSearchParams(params: Record<string, QueryValue> = {}): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
    else search.set(key, String(value));
  }
  return search;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params, signal } = options;
  const query = toSearchParams(params).toString();
  const url = `${API_URL}${path}${query ? `?${query}` : ""}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(
      0,
      "network_error",
      "Can't reach the API server. Check that the backend is running.",
    );
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "http_error",
      error?.message ?? `Request failed (${response.status})`,
      error?.details ?? {},
    );
  }
  return payload as T;
}
