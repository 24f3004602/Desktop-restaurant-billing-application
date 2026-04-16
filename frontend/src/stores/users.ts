import { defineStore } from "pinia";

import { endpoints } from "../api/endpoints";
import { apiClient } from "../api/http";
import type { Role, User } from "../types/models";

interface UserCreatePayload {
  username: string;
  full_name?: string | null;
  password: string;
  role: Role;
}

interface UserUpdatePayload {
  full_name?: string | null;
  role?: Role;
  is_active?: boolean;
  password?: string;
}

export const useUsersStore = defineStore("users", {
  state: () => ({
    users: [] as User[],
    loading: false,
    saving: false,
    error: "",
  }),
  actions: {
    async fetchUsers() {
      this.loading = true;
      this.error = "";
      try {
        const { data } = await apiClient.get<User[]>(endpoints.auth.users);
        this.users = data;
        return data;
      } catch (_error) {
        this.error = "Failed to load staff list.";
        throw _error;
      } finally {
        this.loading = false;
      }
    },
    async createUser(payload: UserCreatePayload) {
      this.saving = true;
      this.error = "";
      try {
        const { data } = await apiClient.post<User>(endpoints.auth.users, payload);
        await this.fetchUsers();
        return data;
      } catch (_error) {
        this.error = "Failed to create staff account.";
        throw _error;
      } finally {
        this.saving = false;
      }
    },
    async updateUser(userId: number, payload: UserUpdatePayload) {
      this.saving = true;
      this.error = "";
      try {
        const { data } = await apiClient.patch<User>(`${endpoints.auth.users}/${userId}`, payload);
        await this.fetchUsers();
        return data;
      } catch (_error) {
        this.error = "Failed to update staff account.";
        throw _error;
      } finally {
        this.saving = false;
      }
    },
  },
});
