/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

interface PrinterApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface PrinterDevice {
  name: string;
  displayName: string;
  status: number;
  isDefault: boolean;
}

interface Window {
  appAPI?: {
    getConfig: () => Promise<PrinterApiResponse<{ appVersion: string; platform: string }>>;
    checkForUpdates: () => Promise<PrinterApiResponse>;
  };
  printerAPI?: {
    list: () => Promise<PrinterApiResponse<PrinterDevice[]>>;
    printHtml: (payload: { html: string; silent?: boolean; deviceName?: string }) => Promise<PrinterApiResponse>;
  };
}
