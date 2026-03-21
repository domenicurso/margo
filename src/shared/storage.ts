import { DEFAULT_SETTINGS, DEFAULT_WIDGET_STATE, SETTINGS_STORAGE_KEY, WIDGET_STORAGE_KEY } from "./constants";
import { getExtensionApi, getStorageArea } from "./extension-api";
import type { CitationSettings, WidgetState } from "./types";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSettings(value: unknown): CitationSettings {
  if (!isObject(value)) {
    return DEFAULT_SETTINGS;
  }

  return {
    style: typeof value.style === "string" ? (value.style as CitationSettings["style"]) : DEFAULT_SETTINGS.style,
    customTemplate: typeof value.customTemplate === "string" ? value.customTemplate : DEFAULT_SETTINGS.customTemplate,
    includeAuthor: typeof value.includeAuthor === "boolean" ? value.includeAuthor : DEFAULT_SETTINGS.includeAuthor,
    includeSiteName: typeof value.includeSiteName === "boolean" ? value.includeSiteName : DEFAULT_SETTINGS.includeSiteName,
    includePublishedDate:
      typeof value.includePublishedDate === "boolean" ? value.includePublishedDate : DEFAULT_SETTINGS.includePublishedDate,
    includeAccessDate: typeof value.includeAccessDate === "boolean" ? value.includeAccessDate : DEFAULT_SETTINGS.includeAccessDate,
    titleQuotes: typeof value.titleQuotes === "boolean" ? value.titleQuotes : DEFAULT_SETTINGS.titleQuotes,
    preferCanonicalUrl:
      typeof value.preferCanonicalUrl === "boolean" ? value.preferCanonicalUrl : DEFAULT_SETTINGS.preferCanonicalUrl,
  };
}

function normalizeWidgetState(value: unknown): WidgetState {
  if (!isObject(value)) {
    return DEFAULT_WIDGET_STATE;
  }

  return {
    corner: typeof value.corner === "string" ? (value.corner as WidgetState["corner"]) : DEFAULT_WIDGET_STATE.corner,
    collapsed: typeof value.collapsed === "boolean" ? value.collapsed : DEFAULT_WIDGET_STATE.collapsed,
  };
}

function readFromArea<T>(areaName: "sync" | "local", key: string, fallback: T): Promise<T> {
  const area = getStorageArea(areaName);
  if (!area) {
    return Promise.resolve(fallback);
  }

  return new Promise(resolve => {
    try {
      area.get(key, result => {
        const value = (result as Record<string, unknown>)[key];
        resolve((value as T | undefined) ?? fallback);
      });
    } catch {
      resolve(fallback);
    }
  });
}

function writeToArea(areaName: "sync" | "local", key: string, value: unknown): Promise<void> {
  const area = getStorageArea(areaName);
  if (!area) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    try {
      area.set({ [key]: value }, resolve);
    } catch {
      resolve();
    }
  });
}

export async function loadCitationSettings() {
  const value = await readFromArea("sync", SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS);
  return normalizeSettings(value);
}

export function saveCitationSettings(settings: CitationSettings) {
  return writeToArea("sync", SETTINGS_STORAGE_KEY, settings);
}

export async function loadWidgetState() {
  const value = await readFromArea("local", WIDGET_STORAGE_KEY, DEFAULT_WIDGET_STATE);
  return normalizeWidgetState(value);
}

export function saveWidgetState(state: WidgetState) {
  return writeToArea("local", WIDGET_STORAGE_KEY, state);
}

export function onCitationSettingsChange(listener: (settings: CitationSettings) => void) {
  const api = getExtensionApi();
  const onChanged = api?.storage?.onChanged;

  if (!onChanged) {
    return () => {};
  }

  const handleChange = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
    if (areaName !== "sync" || !(SETTINGS_STORAGE_KEY in changes)) {
      return;
    }

    listener(normalizeSettings(changes[SETTINGS_STORAGE_KEY]?.newValue));
  };

  try {
    onChanged.addListener(handleChange);
    return () => {
      try {
        onChanged.removeListener(handleChange);
      } catch {
        // Extension context can be invalidated during reloads.
      }
    };
  } catch {
    return () => {};
  }
}

export function onWidgetStateChange(listener: (state: WidgetState) => void) {
  const api = getExtensionApi();
  const onChanged = api?.storage?.onChanged;

  if (!onChanged) {
    return () => {};
  }

  const handleChange = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
    if (areaName !== "local" || !(WIDGET_STORAGE_KEY in changes)) {
      return;
    }

    listener(normalizeWidgetState(changes[WIDGET_STORAGE_KEY]?.newValue));
  };

  try {
    onChanged.addListener(handleChange);
    return () => {
      try {
        onChanged.removeListener(handleChange);
      } catch {
        // Extension context can be invalidated during reloads.
      }
    };
  } catch {
    return () => {};
  }
}
