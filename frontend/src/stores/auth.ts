import { defineStore } from "pinia";

import { endpoints } from "../api/endpoints";
import { apiClient } from "../api/http";
import type { Role, User } from "../types/models";

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    token: localStorage.getItem("pos_token"),
    user: null,
    loading: false,
  }),
  getters: {
    isAuthenticated: (state): boolean => Boolean(state.token),
    role: (state): Role | null => state.user?.role ?? null,
  },
  actions: {
    async login(username: string, password: string) {
      this.loading = true;
      try {
        const { data } = await apiClient.post(endpoints.auth.login, { username, password });
        this.token = data.access_token;
        localStorage.setItem("pos_token", data.access_token);
        await this.fetchMe();
      } finally {
        this.loading = false;
      }
    },
    async fetchMe() {
      if (!this.token) {
        this.user = null;
        return;
      }
      const { data } = await apiClient.get<User>(endpoints.auth.me);
      this.user = data;
    },
    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem("pos_token");
    },
  },
});
