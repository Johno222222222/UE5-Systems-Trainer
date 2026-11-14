import axios from "axios";

// The desktop app serves the UI and the API from the same local address.
// REACT_APP_BACKEND_URL is only for a split dev setup (UI on :3000, API elsewhere).
const origin = process.env.REACT_APP_BACKEND_URL || (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:47321");
export const API = `${origin}/api`;
export const api = axios.create({ baseURL: API });

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
