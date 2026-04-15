import { QueryClient, QueryFunction } from "@tanstack/react-query";

export function getToken(): string | null {
  return localStorage.getItem("gym_crm_token");
}

export function setToken(token: string): void {
  localStorage.setItem("gym_crm_token", token);
}

export function removeToken(): void {
  localStorage.removeItem("gym_crm_token");
}

function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let payload: any = null;

    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

    const emailErrors = Array.isArray(payload?.errors?.email)
      ? payload.errors.email.map((value: unknown) => String(value).toLowerCase())
      : [];

    if (emailErrors.some((message: string) => message.includes("already been taken"))) {
      throw new Error("A member with this email is already registered, please choose another email address");
    }

    const validationErrors = payload?.errors && typeof payload.errors === "object"
      ? Object.values(payload.errors).flat().map((value) => String(value)).join(" ")
      : "";
    const message = validationErrors || payload?.message || text;

    throw new Error(message);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = { ...getAuthHeaders() };
  if (data) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = Array.isArray(queryKey) ? queryKey.join("") : String(queryKey as unknown);
    const res = await fetch(url, { headers: getAuthHeaders() });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
