interface ExtensionStorageAreaLike {
  get(keys: string | string[] | Record<string, unknown> | null, callback: (items: Record<string, unknown>) => void): void;
  set(items: Record<string, unknown>, callback?: () => void): void;
}

interface ExtensionStorageLike {
  sync?: ExtensionStorageAreaLike;
  local?: ExtensionStorageAreaLike;
  onChanged?: {
    addListener(listener: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, areaName: string) => void): void;
    removeListener(listener: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, areaName: string) => void): void;
  };
}

interface ExtensionRuntimeLike {
  openOptionsPage?: () => Promise<void> | void;
  sendMessage?: (message: unknown, callback?: (response?: unknown) => void) => void;
  onInstalled?: {
    addListener(listener: () => void): void;
  };
  onMessage?: {
    addListener(
      listener: (
        message: unknown,
        sender: unknown,
        sendResponse: (response?: unknown) => void,
      ) => boolean | void,
    ): void;
  };
}

interface ExtensionActionLike {
  onClicked?: {
    addListener(listener: () => void): void;
  };
}

interface ExtensionApiLike {
  storage?: ExtensionStorageLike;
  runtime?: ExtensionRuntimeLike;
  action?: ExtensionActionLike;
}

export function getExtensionApi(): ExtensionApiLike | null {
  return (globalThis as typeof globalThis & { chrome?: ExtensionApiLike }).chrome ?? null;
}

export function getStorageArea(area: "sync" | "local") {
  return getExtensionApi()?.storage?.[area] ?? null;
}

export function openExtensionOptionsPage() {
  const runtime = getExtensionApi()?.runtime;
  const sendMessage = runtime?.sendMessage;

  if (runtime?.openOptionsPage) {
    try {
      return runtime.openOptionsPage();
    } catch {
      return undefined;
    }
  }

  if (sendMessage) {
    return new Promise(resolve => {
      try {
        sendMessage({ type: "OPEN_OPTIONS_PAGE" }, resolve);
      } catch {
        resolve(undefined);
      }
    });
  }

  return undefined;
}
