import { defineStore } from "pinia";

export type NotificationType = "success" | "error" | "info" | "warning";

interface NotificationPayload {
  message: string;
  type?: NotificationType;
  duration?: number;
}

export interface NotificationItem {
  id: number;
  message: string;
  type: NotificationType;
  duration: number;
}

export const useNotificationsStore = defineStore("notifications", {
  state: () => ({
    items: [] as NotificationItem[],
    nextId: 1,
  }),
  actions: {
    push(payload: NotificationPayload): number {
      const id = this.nextId;
      this.nextId += 1;

      const item: NotificationItem = {
        id,
        message: payload.message,
        type: payload.type ?? "info",
        duration: payload.duration ?? 3500,
      };

      this.items.push(item);

      if (item.duration > 0) {
        window.setTimeout(() => {
          this.remove(id);
        }, item.duration);
      }

      return id;
    },
    remove(id: number) {
      this.items = this.items.filter((item) => item.id !== id);
    },
    clear() {
      this.items = [];
    },
  },
});
