import type { AxiosError } from "axios";

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
  detail?: string;
}

export function getApiErrorMessage(error: unknown, fallback = "Request failed."): string {
  const axiosError = error as AxiosError<ApiErrorResponse>;
  return axiosError?.response?.data?.error?.message || axiosError?.response?.data?.detail || fallback;
}
