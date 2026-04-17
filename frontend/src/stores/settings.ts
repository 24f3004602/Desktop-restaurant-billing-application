import { defineStore } from "pinia";

export interface ReceiptSettings {
  name: string;
  address: string;
  phone: string;
  gstin: string;
  footer: string;
}

function defaultReceiptSettings(): ReceiptSettings {
  return {
    name: import.meta.env.VITE_RECEIPT_NAME || "Restaurant POS",
    address: import.meta.env.VITE_RECEIPT_ADDRESS || "",
    phone: import.meta.env.VITE_RECEIPT_PHONE || "",
    gstin: import.meta.env.VITE_RECEIPT_GSTIN || "",
    footer: import.meta.env.VITE_RECEIPT_FOOTER || "Thank you for dining with us.",
  };
}

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    receipt: defaultReceiptSettings(),
    loading: false,
    saving: false,
    loaded: false,
    error: "",
  }),
  actions: {
    async loadReceiptSettings() {
      this.loading = true;
      this.error = "";
      try {
        const response = await window.appAPI?.getReceiptSettings?.();
        if (response?.ok && response.data) {
          this.receipt = {
            name: response.data.name || defaultReceiptSettings().name,
            address: response.data.address || "",
            phone: response.data.phone || "",
            gstin: response.data.gstin || "",
            footer: response.data.footer || defaultReceiptSettings().footer,
          };
          this.loaded = true;
          return this.receipt;
        }

        this.receipt = defaultReceiptSettings();
        this.loaded = true;
        if (response?.error) {
          this.error = response.error;
        }
        return this.receipt;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Failed to load receipt settings.";
        this.receipt = defaultReceiptSettings();
        this.loaded = true;
        return this.receipt;
      } finally {
        this.loading = false;
      }
    },
    async saveReceiptSettings(payload: ReceiptSettings) {
      this.saving = true;
      this.error = "";
      try {
        const response = await window.appAPI?.saveReceiptSettings?.(payload);
        if (!response?.ok || !response.data) {
          throw new Error(response?.error || "Failed to save receipt settings.");
        }

        this.receipt = response.data;
        this.loaded = true;
        return this.receipt;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Failed to save receipt settings.";
        throw error;
      } finally {
        this.saving = false;
      }
    },
  },
});
