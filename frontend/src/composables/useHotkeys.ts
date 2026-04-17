import { onBeforeUnmount, onMounted } from "vue";

interface PosHotkeyHandlers {
  onSendKot: () => void | Promise<void>;
  onGenerateBill: () => void | Promise<void>;
  onEscape: () => void | Promise<void>;
  onQuantityDigit: (digit: number) => void | Promise<void>;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useHotkeys(handlers: PosHotkeyHandlers): void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditableElement(event.target)) {
      return;
    }

    if (event.key === "F8") {
      event.preventDefault();
      void handlers.onSendKot();
      return;
    }

    if (event.key === "F9") {
      event.preventDefault();
      void handlers.onGenerateBill();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      void handlers.onEscape();
      return;
    }

    if (/^[1-9]$/.test(event.key)) {
      void handlers.onQuantityDigit(Number(event.key));
    }
  };

  onMounted(() => {
    document.addEventListener("keydown", onKeyDown);
  });

  onBeforeUnmount(() => {
    document.removeEventListener("keydown", onKeyDown);
  });
}
