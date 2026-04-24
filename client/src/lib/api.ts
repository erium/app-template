import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { BASE_PATH } from "./basePath";

// ─── Typed fetch wrapper ───

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const fullUrl = url.startsWith("/") ? BASE_PATH + url : url;
  const res = await fetch(fullUrl, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const error = new ApiError(body.error || res.statusText, res.status, body);
    throw error;
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── API methods ───

export const api = {
  // Auth
  getMe: () => apiFetch<UserData | null>("/api/auth/me"),
  login: (data: { email: string; password: string }) =>
    apiFetch<{ user: UserData }>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  register: (data: { email: string; password: string; name: string; companyName: string }) =>
    apiFetch<{ success: boolean }>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  logout: () => apiFetch<{ success: boolean }>("/api/auth/logout", { method: "POST" }),
  verifyEmail: (data: { token: string }) =>
    apiFetch<{ success: boolean }>("/api/auth/verify-email", { method: "POST", body: JSON.stringify(data) }),
  join: (data: { token: string; password: string; name: string }) =>
    apiFetch<{ success: boolean }>("/api/auth/join", { method: "POST", body: JSON.stringify(data) }),
  forgotPassword: (data: { email: string }) =>
    apiFetch<{ success: boolean }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(data) }),
  resetPassword: (data: { token: string; password: string }) =>
    apiFetch<{ success: boolean }>("/api/auth/reset-password", { method: "POST", body: JSON.stringify(data) }),
  updateLanguage: (data: { language: "de" | "en" }) =>
    apiFetch<{ success: boolean }>("/api/auth/language", { method: "POST", body: JSON.stringify(data) }),
  deleteAccount: () =>
    apiFetch<{ success: boolean }>("/api/auth/account", { method: "DELETE" }),

  // Tenant
  getTenantSettings: () => apiFetch<{ name: string }>("/api/tenant/settings"),
  updateTenantName: (data: { name: string }) =>
    apiFetch<{ success: boolean }>("/api/tenant/name", { method: "PUT", body: JSON.stringify(data) }),
  getUsers: () => apiFetch<UserData[]>("/api/tenant/users"),
  inviteUser: (data: { email: string; role: string }) =>
    apiFetch<{ success: boolean; token: string }>("/api/tenant/invite", { method: "POST", body: JSON.stringify(data) }),
  updateUserRole: (userId: number, role: string) =>
    apiFetch<unknown>(`/api/tenant/users/${userId}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
  getPendingInvites: () => apiFetch<InviteData[]>("/api/tenant/invites"),
  revokeInvitation: (id: number) =>
    apiFetch<{ success: boolean }>(`/api/tenant/invites/${id}`, { method: "DELETE" }),
  resendInvitation: (id: number) =>
    apiFetch<{ token: string }>(`/api/tenant/invites/${id}/resend`, { method: "POST" }),
  deleteUser: (userId: number) =>
    apiFetch<{ success: boolean }>(`/api/tenant/users/${userId}`, { method: "DELETE" }),
  deleteTenant: () =>
    apiFetch<{ success: boolean }>("/api/tenant", { method: "DELETE" }),

  // Payment
  createCheckoutSession: (data: { credits: number; amount: number }) =>
    apiFetch<{ url: string }>("/api/payment/checkout", { method: "POST", body: JSON.stringify(data) }),
  getTransactions: () => apiFetch<TransactionData[]>("/api/payment/transactions"),
};

// ─── Types ───

export type UserData = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  tenantId: number;
  language: string | null;
  [key: string]: unknown;
};

export type InviteData = {
  id: number;
  email: string;
  role: string;
  token: string;
  status: string;
  tenantId: number;
  expiresAt: string;
  createdAt: string;
};

export type TransactionData = {
  id: number;
  userId: number;
  amount: number;
  credits: number;
  type: string;
  stripeSessionId: string | null;
  createdAt: string;
};

// ─── Query key constants ───

export const queryKeys = {
  me: ["auth", "me"] as const,
  tenantSettings: ["tenant", "settings"] as const,
  tenantUsers: ["tenant", "users"] as const,
  pendingInvites: ["tenant", "invites"] as const,
  transactions: ["payment", "transactions"] as const,
};
