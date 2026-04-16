import { ref } from "vue";

interface PrinterDevice {
  name: string;
  displayName: string;
  status: number;
  isDefault: boolean;
}

export function usePrinter() {
  const printers = ref<PrinterDevice[]>([]);
  const loading = ref(false);
  const error = ref("");

  async function loadPrinters() {
    loading.value = true;
    error.value = "";

    try {
      const response = await window.printerAPI?.list?.();
      if (response?.ok && Array.isArray(response.data)) {
        printers.value = response.data;
        return;
      }
      throw new Error(response?.error || "Unable to load printers");
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Unable to load printers";
      printers.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function printHtml(html: string, deviceName?: string) {
    const response = await window.printerAPI?.printHtml?.({
      html,
      silent: true,
      deviceName,
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Print failed");
    }
  }

  return {
    printers,
    loading,
    error,
    loadPrinters,
    printHtml,
  };
}
