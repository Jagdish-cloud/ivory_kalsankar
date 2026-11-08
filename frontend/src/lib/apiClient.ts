import axios from "axios";

export const AUTH_TOKEN_STORAGE_KEY = "ivory-lace-token";
/** Super admins pick which store they are acting in; sent to the API as X-Store-Id. */
export const ACTIVE_STORE_STORAGE_KEY = "ivory-lace-active-store";
export const BILL_DRAFT_STORAGE_KEY = "ivory-lace-bill-draft";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  const activeStore = localStorage.getItem(ACTIVE_STORE_STORAGE_KEY);
  if (activeStore) {
    config.headers = config.headers ?? {};
    config.headers["X-Store-Id"] = activeStore;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_STORE_STORAGE_KEY);
      localStorage.removeItem(BILL_DRAFT_STORAGE_KEY);
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function extractErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message ?? fallback;
  }
  return fallback;
}
