import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "../stores/auth";
import type { Role } from "../types/models";
import HistoryView from "../views/HistoryView.vue";
import LoginView from "../views/LoginView.vue";
import MenuManagementView from "../views/MenuManagementView.vue";
import PosView from "../views/PosView.vue";
import ReportsView from "../views/ReportsView.vue";
import SettingsView from "../views/SettingsView.vue";
import StaffManagementView from "../views/StaffManagementView.vue";

const routes = [
  { path: "/", redirect: "/pos" },
  { path: "/login", component: LoginView, meta: { guest: true } },
  { path: "/pos", component: PosView, meta: { auth: true, roles: ["admin", "cashier", "waiter"] as Role[] } },
  { path: "/menu", component: MenuManagementView, meta: { auth: true, roles: ["admin"] as Role[] } },
  { path: "/staff", component: StaffManagementView, meta: { auth: true, roles: ["admin"] as Role[] } },
  { path: "/reports", component: ReportsView, meta: { auth: true, roles: ["admin", "cashier"] as Role[] } },
  { path: "/history", component: HistoryView, meta: { auth: true, roles: ["admin", "cashier", "waiter"] as Role[] } },
  { path: "/settings", component: SettingsView, meta: { auth: true, roles: ["admin"] as Role[] } },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

export function setupRouterGuards() {
  router.beforeEach(async (to) => {
    const auth = useAuthStore();

    if (auth.token && !auth.user) {
      try {
        await auth.fetchMe();
      } catch (_err) {
        auth.logout();
      }
    }

    if (to.meta.guest && auth.isAuthenticated) {
      return "/pos";
    }

    if (to.meta.auth && !auth.isAuthenticated) {
      return "/login";
    }

    const allowedRoles = to.meta.roles as Role[] | undefined;
    if (allowedRoles?.length && auth.role && !allowedRoles.includes(auth.role)) {
      return "/pos";
    }

    return true;
  });
}
