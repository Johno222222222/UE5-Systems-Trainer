import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API, withCredentials: true });

let refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const cfg = error.config;
    if (error.response?.status === 401 && !cfg._retried && !cfg.url.startsWith("/auth/")) {
      cfg._retried = true;
      refreshing = refreshing || api.post("/auth/refresh").finally(() => { refreshing = null; });
      try {
        await refreshing;
        return api(cfg);
      } catch {
        /* fall through to the original 401 */
      }
    }
    return Promise.reject(error);
  }
);

export function errorText(e) {
  const detail = e?.response?.data?.detail;
  if (detail == null) return e?.message || "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  if (typeof detail.message === "string") return detail.message;
  if (typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export function downloadBlob(data, filename, type = "application/json") {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export function exportPayload(name, system, context) {
  return { format: "ue5-architect-project", version: 1, name, system, context };
}
