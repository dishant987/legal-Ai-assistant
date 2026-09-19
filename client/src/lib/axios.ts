import axios, { type AxiosError, type AxiosInstance } from 'axios';

import { ApiError } from './apiError.js';

/**
 * The one configured client.
 *
 * Nothing in the app calls `axios.get` directly. Everything goes through here,
 * so request ids, timeouts and error normalisation happen once rather than at
 * every call site — and forgetting one of them is not possible.
 */
export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  // Echoed back by the server and threaded through its logs, so a user quoting
  // a reference code is enough to find the exact request.
  config.headers.set('X-Request-Id', crypto.randomUUID());
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const axiosError = error as AxiosError;

    if (axiosError.response?.data !== undefined) {
      return Promise.reject(ApiError.fromEnvelope(axiosError.response.data));
    }
    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return Promise.reject(ApiError.timeout());
    }
    return Promise.reject(ApiError.network());
  },
);
