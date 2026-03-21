import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import {
  Component,
  StrictMode,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

import type { CitationSettings, CitationStyle } from "./shared/types";

import { generateCitation } from "./shared/citation";
import {
  CUSTOM_TEMPLATE_HELP,
  DEFAULT_SETTINGS,
  SAMPLE_METADATA,
} from "./shared/constants";
import { loadCitationSettings, saveCitationSettings } from "./shared/storage";

const STYLE_OPTIONS: {
  value: Exclude<CitationStyle, "custom">;
  label: string;
}[] = [
  { value: "mla", label: "MLA" },
  { value: "apa", label: "APA" },
  { value: "chicago", label: "Chicago" },
  { value: "harvard", label: "Harvard" },
];

const PRESET_TEMPLATES: Record<Exclude<CitationStyle, "custom">, string> = {
  mla: "[[{{author}}.]][[ {{titleQuoted}}.]][[ {{siteName}},]][[ {{publishedDate}},]][[ {{url}}]][[ Accessed {{accessDate}}.]]",
  apa: "{{author}}[[ ({{publishedDate}}).]][[ {{title}}.]][[ {{siteName}}.]][[ {{url}}]][[ Accessed {{accessDate}}.]]",
  chicago:
    "[[{{author}}.]][[ {{titleQuoted}}.]][[ {{siteName}}.]][[ {{publishedDate}}.]][[ {{url}}]]",
  harvard:
    "{{author}}[[ ({{publishedDate}})]][[ {{title}}.]][[ {{siteName}}.]][[ [Accessed {{accessDate}}]][[ {{url}}]]",
};

const TOGGLE_OPTIONS: {
  key: keyof Pick<
    CitationSettings,
    | "includeAuthor"
    | "includeSiteName"
    | "includePublishedDate"
    | "includeAccessDate"
    | "titleQuotes"
    | "preferCanonicalUrl"
  >;
  title: string;
  description: string;
}[] = [
  {
    key: "includeAuthor",
    title: "Include author",
    description: "Use detected author or creator when available.",
  },
  {
    key: "includeSiteName",
    title: "Include site name",
    description: "Keep the publication or site label in the result.",
  },
  {
    key: "includePublishedDate",
    title: "Include published date",
    description: "Prefer published timestamps over access-only citations.",
  },
  {
    key: "includeAccessDate",
    title: "Include access date",
    description: "Append the date the widget generated the citation.",
  },
  {
    key: "titleQuotes",
    title: "Quote titles",
    description: "Wrap titles in quotation marks when the style supports it.",
  },
  {
    key: "preferCanonicalUrl",
    title: "Prefer canonical URL",
    description: "Use the page's canonical link when the site provides one.",
  },
];

const TEMPLATE_TOKENS = [
  ["{{author}}", "Detected author or creator"],
  ["{{title}}", "Page title without quotation marks"],
  ["{{titleQuoted}}", "Page title with quotation marks"],
  ["{{siteName}}", "Publication or site name"],
  ["{{publishedDate}}", "Normalized publication date"],
  ["{{accessDate}}", "Current access date"],
  ["{{url}}", "Canonical URL when available"],
] as const;

function OptionsApp() {
  const [settings, setSettings] = useState<CitationSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void loadCitationSettings()
      .then(setSettings)
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveCitationSettings(settings);
    }, 160);

    return () => window.clearTimeout(timeoutId);
  }, [loaded, settings]);

  let preview = "";
  try {
    preview = generateCitation(SAMPLE_METADATA, settings);
  } catch (error) {
    preview = error instanceof Error ? error.message : "Preview unavailable.";
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="m-0 text-3xl font-semibold tracking-tight text-zinc-100">
              Margo Settings
            </h1>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-900"
            onClick={() => setSettings(DEFAULT_SETTINGS)}
          >
            <ArrowCounterClockwiseIcon size={16} weight="fill" />
            <span>Reset</span>
          </button>
        </header>

        <section className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
          <div className="space-y-4 border-b border-zinc-700 p-5">
            <h2 className="text-base font-medium text-zinc-100">Fields</h2>

            <div className="space-y-3">
              {TOGGLE_OPTIONS.map((option) => (
                <label className="flex items-start gap-3" key={option.key}>
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-zinc-100"
                    checked={settings[option.key]}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setSettings((current) => ({
                        ...current,
                        [option.key]: checked,
                      }));
                    }}
                  />
                  <span>
                    <span className="block text-sm font-medium text-zinc-100">
                      {option.title}
                    </span>
                    <span className="mt-0.5 block text-sm leading-6 text-zinc-400">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-4 border-b border-zinc-700 p-5">
            <h2 className="text-base font-medium text-zinc-100">Template</h2>

            <div className="flex w-full gap-2">
              {STYLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    settings.customTemplate === PRESET_TEMPLATES[option.value]
                      ? "block w-full rounded-lg border border-zinc-500 bg-zinc-900 px-2.5 py-1.5 text-left"
                      : "block w-full rounded-lg border border-zinc-700 px-2.5 py-1.5 text-left transition hover:bg-zinc-900"
                  }
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      style: option.value,
                      customTemplate: PRESET_TEMPLATES[option.value],
                    }))
                  }
                >
                  <span className="block text-sm font-medium text-zinc-100">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>

            <div>
              <textarea
                className="h-48 w-full resize-none rounded-l-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm leading-relaxed text-zinc-100 outline-none focus:border-zinc-500"
                value={settings.customTemplate}
                onChange={(event) => {
                  const customTemplate = event.currentTarget.value;
                  setSettings((current) => ({
                    ...current,
                    style: "custom",
                    customTemplate,
                  }));
                }}
                placeholder="{{author}}. {{titleQuoted}}. {{siteName}}. {{url}}"
              />
              <div className="text-zinc-100">{preview}</div>
            </div>

            <p className="m-0 text-sm leading-6 text-zinc-400">
              {CUSTOM_TEMPLATE_HELP}
            </p>

            <div className="space-y-2 text-sm text-zinc-400">
              {TEMPLATE_TOKENS.map(([token, description]) => (
                <p className="m-0" key={token}>
                  <code className="font-mono text-zinc-200">{token}</code>{" "}
                  <span>{description}</span>
                </p>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

class OptionsErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
          <div className="mx-auto max-w-2xl">
            <section className="rounded-xl border border-zinc-700 p-5">
              <h2 className="m-0 text-lg font-medium text-zinc-100">
                Settings page error
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Reload the extension page once. If it happens again, the current
                settings payload is invalid.
              </p>
            </section>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <OptionsErrorBoundary>
        <OptionsApp />
      </OptionsErrorBoundary>
    </StrictMode>,
  );
}
