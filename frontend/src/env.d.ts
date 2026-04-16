/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RECEIPT_NAME?: string;
  readonly VITE_RECEIPT_ADDRESS?: string;
  readonly VITE_RECEIPT_PHONE?: string;
  readonly VITE_RECEIPT_GSTIN?: string;
  readonly VITE_RECEIPT_FOOTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

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

interface SavePdfResult {
  canceled: boolean;
  filePath?: string;
}

interface Window {
  appAPI?: {
    getConfig: () => Promise<PrinterApiResponse<{ appVersion: string; platform: string }>>;
    checkForUpdates: () => Promise<PrinterApiResponse>;
  };
  printerAPI?: {
    list: () => Promise<PrinterApiResponse<PrinterDevice[]>>;
    printHtml: (payload: { html: string; silent?: boolean; deviceName?: string }) => Promise<PrinterApiResponse>;
    savePdf: (payload: { html: string; filePath?: string }) => Promise<PrinterApiResponse<SavePdfResult>>;
  };
}
