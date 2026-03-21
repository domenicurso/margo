import { DEFAULT_SETTINGS, DEFAULT_WIDGET_STATE, SETTINGS_STORAGE_KEY, WIDGET_STORAGE_KEY } from "./shared/constants";
import { getExtensionApi, getStorageArea } from "./shared/extension-api";

async function seedStorageDefaults() {
  const sync = getStorageArea("sync");
  const local = getStorageArea("local");

  if (sync) {
    sync.get(SETTINGS_STORAGE_KEY, result => {
      if (!(SETTINGS_STORAGE_KEY in result)) {
        sync.set({ [SETTINGS_STORAGE_KEY]: DEFAULT_SETTINGS });
      }
    });
  }

  if (local) {
    local.get(WIDGET_STORAGE_KEY, result => {
      if (!(WIDGET_STORAGE_KEY in result)) {
        local.set({ [WIDGET_STORAGE_KEY]: DEFAULT_WIDGET_STATE });
      }
    });
  }
}

const extensionApi = getExtensionApi();

extensionApi?.runtime?.onInstalled?.addListener(() => {
  void seedStorageDefaults();
});

extensionApi?.action?.onClicked?.addListener(() => {
  void extensionApi.runtime?.openOptionsPage?.();
});

extensionApi?.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
  if (
    message &&
    typeof message === "object" &&
    "type" in message &&
    (message as { type?: string }).type === "OPEN_OPTIONS_PAGE"
  ) {
    void extensionApi.runtime?.openOptionsPage?.();
    sendResponse({ ok: true });
  }
});
