import type { CitationSettings, CitationStyle, PageMetadata } from "./types";

export type PresetCitationStyle = Exclude<CitationStyle, "custom">;
export type CitationTemplateDiagnosticSeverity = "error" | "warning";

export const PRESET_CITATION_STYLES = [
  "mla",
  "apa",
  "chicago",
  "harvard",
] as const satisfies readonly PresetCitationStyle[];

export interface CitationTemplateDiagnostic {
  code: string;
  severity: CitationTemplateDiagnosticSeverity;
  message: string;
  start: number;
  end: number;
}

export interface CitationTemplateVariableDefinition {
  key: string;
  description: string;
  example: string;
}

export interface CitationTemplatePresetDefinition {
  description: string;
  label: string;
  style: PresetCitationStyle;
  template: string;
}

type CitationTemplateValue =
  | CitationTemplateRecord
  | string
  | null;

interface CitationTemplateRecord {
  [key: string]: CitationTemplateValue;
}

export interface CitationTemplateContext {
  values: CitationTemplateRecord;
}

export interface CitationTemplateTextNode {
  type: "text";
  value: string;
  start: number;
  end: number;
}

export interface CitationTemplateValueNode {
  type: "value";
  path: string[];
  raw: string;
  start: number;
  end: number;
}

export interface CitationTemplateSectionNode {
  type: "section";
  path: string[];
  raw: string;
  children: TemplateNode[];
  start: number;
  end: number;
}

export type CitationTemplateNode =
  | CitationTemplateSectionNode
  | CitationTemplateTextNode
  | CitationTemplateValueNode;

type TemplateNode = CitationTemplateNode;

export interface CitationTemplateParseResult {
  diagnostics: CitationTemplateDiagnostic[];
  nodes: TemplateNode[];
}

interface ParsedNodes {
  closed: boolean;
  nodes: TemplateNode[];
}

interface ResolvedTemplateValue {
  exists: boolean;
  value: CitationTemplateValue | undefined;
}

interface RenderedNodes {
  hasBlockingIssue: boolean;
  text: string;
}

export interface CitationTemplateResolvedVariable {
  key: string;
  value: string | null;
}

export interface CitationTemplateRenderResult {
  diagnostics: CitationTemplateDiagnostic[];
  text: string;
  valid: boolean;
}

export const CITATION_TEMPLATE_PRESET_DEFINITIONS: CitationTemplatePresetDefinition[] =
  [
    {
      style: "mla",
      label: "MLA",
      description: "Quoted title, site label, publication date, access date, URL.",
      template:
        "{{#author}}{{author}}. {{/author}}{{#title.quoted}}{{title.quoted}}. {{/title.quoted}}{{#site.name}}{{site.name}}, {{/site.name}}{{#date.published.medium}}{{date.published.medium}}. {{/date.published.medium}}{{#date.accessed.long}}Accessed {{date.accessed.long}}. {{/date.accessed.long}}{{#url.resolved}}{{url.resolved}}{{/url.resolved}}",
    },
    {
      style: "apa",
      label: "APA",
      description: "Author, publication date, title, site name, retrieval date, URL.",
      template:
        "{{#author}}{{author}} {{/author}}{{#date.published.medium}}({{date.published.medium}}). {{/date.published.medium}}{{#title.plain}}{{title.plain}}. {{/title.plain}}{{#site.name}}{{site.name}}. {{/site.name}}{{#date.accessed.long}}Retrieved {{date.accessed.long}}, from {{/date.accessed.long}}{{#url.resolved}}{{url.resolved}}{{/url.resolved}}",
    },
    {
      style: "chicago",
      label: "Chicago",
      description: "Quoted title, site name, publication date, URL.",
      template:
        "{{#author}}{{author}}. {{/author}}{{#title.quoted}}{{title.quoted}}. {{/title.quoted}}{{#site.name}}{{site.name}}. {{/site.name}}{{#date.published.medium}}{{date.published.medium}}. {{/date.published.medium}}{{#url.resolved}}{{url.resolved}}{{/url.resolved}}",
    },
    {
      style: "harvard",
      label: "Harvard",
      description: "Author, publication date, title, site name, access date, URL.",
      template:
        "{{#author}}{{author}} {{/author}}{{#date.published.medium}}({{date.published.medium}}) {{/date.published.medium}}{{#title.plain}}{{title.plain}}. {{/title.plain}}{{#site.name}}{{site.name}}. {{/site.name}}{{#date.accessed.long}}Accessed {{date.accessed.long}}. {{/date.accessed.long}}{{#url.resolved}}{{url.resolved}}{{/url.resolved}}",
    },
  ];

export const CITATION_TEMPLATE_PRESETS: Record<PresetCitationStyle, string> =
  Object.fromEntries(
    CITATION_TEMPLATE_PRESET_DEFINITIONS.map((preset) => [
      preset.style,
      preset.template,
    ]),
  ) as Record<PresetCitationStyle, string>;

export const DEFAULT_CITATION_STYLE: PresetCitationStyle = "mla";
export const DEFAULT_CITATION_TEMPLATE =
  CITATION_TEMPLATE_PRESETS[DEFAULT_CITATION_STYLE];

export const CITATION_TEMPLATE_VARIABLES: CitationTemplateVariableDefinition[] =
  [
    {
      key: "author",
      description: "Detected author, formatted for the current citation style.",
      example: "Lee, J.",
    },
    {
      key: "title.plain",
      description: "Page title without quotes.",
      example: "How Floating Citation Widgets Improve Research Workflows",
    },
    {
      key: "title.quoted",
      description: "Page title with quote behavior applied.",
      example: '"How Floating Citation Widgets Improve Research Workflows"',
    },
    {
      key: "site.name",
      description: "Publication or site name.",
      example: "Signal Atlas",
    },
    {
      key: "site.domain",
      description: "Domain derived from the resolved citation URL.",
      example: "signalatlas.example.com",
    },
    {
      key: "date.published.medium",
      description: "Publication date in short form.",
      example: "Feb 18, 2026",
    },
    {
      key: "date.published.long",
      description: "Publication date in long form.",
      example: "February 18, 2026",
    },
    {
      key: "date.accessed.medium",
      description: "Access date in short form.",
      example: "Mar 21, 2026",
    },
    {
      key: "date.accessed.long",
      description: "Access date in long form.",
      example: "March 21, 2026",
    },
    {
      key: "url.resolved",
      description: "URL used in the final citation, respecting canonical settings.",
      example: "https://signalatlas.example.com/research/floating-citations",
    },
    {
      key: "url.canonical",
      description: "Canonical URL declared by the page when available.",
      example: "https://signalatlas.example.com/research/floating-citations",
    },
  ];

export const CUSTOM_TEMPLATE_HELP =
  'Use {{path}} to render values and {{#path}}...{{/path}} to render a block only when that path has a value. Dot paths are supported, for example {{title.quoted}} or {{#date.published.medium}}...{{/date.published.medium}}.';

export function isPresetCitationStyle(
  value: string,
): value is PresetCitationStyle {
  return PRESET_CITATION_STYLES.includes(value as PresetCitationStyle);
}

export function isCitationStyle(value: string): value is CitationStyle {
  return value === "custom" || isPresetCitationStyle(value);
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function formatDate(
  dateString: string | null,
  format: "long" | "medium" = "medium",
) {
  if (!dateString) {
    return null;
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: format === "long" ? "long" : "short",
    day: "numeric",
  }).format(date);
}

function cleanupCitation(text: string) {
  return text
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([(])\s+/g, "$1")
    .replace(/\s+([)\]])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\.\./g, ".")
    .trim();
}

function quoteTitle(title: string, titleQuotes: boolean) {
  return titleQuotes ? `"${title}"` : title;
}

function getCitationUrl(metadata: PageMetadata, settings: CitationSettings) {
  const canonicalUrl = normalizeText(metadata.canonicalUrl);
  const url = normalizeText(metadata.url);

  if (settings.preferCanonicalUrl && canonicalUrl) {
    return canonicalUrl;
  }

  return url;
}

function formatAuthor(author: string | null, style: CitationSettings["style"]) {
  if (!author) {
    return null;
  }

  const compactAuthor = author.replace(/^by\s+/i, "").trim();
  const parts = compactAuthor.split(/\s+/);
  if (parts.length < 2) {
    return compactAuthor;
  }

  if (style === "apa" || style === "harvard") {
    const lastName = parts.at(-1);
    const initials = parts
      .slice(0, -1)
      .map((part) => `${part.charAt(0).toUpperCase()}.`)
      .join(" ");
    return `${lastName}, ${initials}`;
  }

  return compactAuthor;
}

function getDomain(url: string | null) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function resolveTemplatePath(
  values: CitationTemplateRecord,
  path: string[],
): ResolvedTemplateValue {
  let current: CitationTemplateValue = values;

  for (const segment of path) {
    if (
      current === null ||
      typeof current !== "object" ||
      !(segment in current)
    ) {
      return { exists: false, value: undefined };
    }

    const nextValue: CitationTemplateValue | undefined = current[segment];
    if (typeof nextValue === "undefined") {
      return { exists: false, value: undefined };
    }

    current = nextValue;
  }

  return { exists: true, value: current };
}

function hasRenderableValue(value: CitationTemplateValue | undefined): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.values(value).some((child) => hasRenderableValue(child));
}

function stringifyTemplateValue(value: CitationTemplateValue | undefined) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return null;
}

export function buildCitationTemplateContext(
  metadata: PageMetadata,
  settings: CitationSettings,
): CitationTemplateContext {
  const title = normalizeText(metadata.title);
  const resolvedUrl = getCitationUrl(metadata, settings);

  return {
    values: {
      author: settings.includeAuthor
        ? formatAuthor(metadata.author, settings.style)
        : null,
      title: {
        plain: title,
        quoted: title ? quoteTitle(title, settings.titleQuotes) : null,
      },
      site: {
        domain: getDomain(resolvedUrl),
        name: settings.includeSiteName ? normalizeText(metadata.siteName) : null,
      },
      date: {
        accessed: {
          long: settings.includeAccessDate
            ? formatDate(metadata.accessedAt, "long")
            : null,
          medium: settings.includeAccessDate
            ? formatDate(metadata.accessedAt, "medium")
            : null,
        },
        published: {
          long: settings.includePublishedDate
            ? formatDate(metadata.publishedDate, "long")
            : null,
          medium: settings.includePublishedDate
            ? formatDate(metadata.publishedDate, "medium")
            : null,
        },
      },
      url: {
        canonical: normalizeText(metadata.canonicalUrl),
        resolved: resolvedUrl,
      },
    },
  };
}

export function listCitationTemplateVariableValues(
  context: CitationTemplateContext,
): CitationTemplateResolvedVariable[] {
  return CITATION_TEMPLATE_VARIABLES.map((variable) => ({
    key: variable.key,
    value: stringifyTemplateValue(
      resolveTemplatePath(context.values, variable.key.split(".")).value,
    ),
  }));
}

function parseTemplatePath(
  raw: string,
  start: number,
  end: number,
  diagnostics: CitationTemplateDiagnostic[],
) {
  const key = raw.trim();
  if (!key) {
    diagnostics.push({
      code: "empty-tag",
      severity: "error",
      message: "Empty template tag.",
      start,
      end,
    });
    return [];
  }

  if (!/^[a-zA-Z][\w-]*(\.[a-zA-Z][\w-]*)*$/.test(key)) {
    diagnostics.push({
      code: "invalid-path",
      severity: "error",
      message: `Invalid template path "${key}".`,
      start,
      end,
    });
    return [];
  }

  return key.split(".");
}

function hasTemplateTag(nodes: TemplateNode[]) {
  return nodes.some((node) => {
    if (node.type === "text") {
      return false;
    }

    if (node.type === "section") {
      return true;
    }

    return true;
  });
}

export function parseCitationTemplate(template: string): CitationTemplateParseResult {
  const diagnostics: CitationTemplateDiagnostic[] = [];
  let cursor = 0;

  const parseNodes = (expectedSectionPath?: string[]): ParsedNodes => {
    const nodes: TemplateNode[] = [];
    let textStart = cursor;
    let textBuffer = "";

    const flushText = () => {
      if (!textBuffer) {
        return;
      }

      nodes.push({
        type: "text",
        value: textBuffer,
        start: textStart,
        end: cursor,
      });
      textBuffer = "";
    };

    while (cursor < template.length) {
      if (!template.startsWith("{{", cursor)) {
        textBuffer += template[cursor] ?? "";
        cursor += 1;
        continue;
      }

      flushText();

      const start = cursor;
      const close = template.indexOf("}}", cursor + 2);
      if (close === -1) {
        diagnostics.push({
          code: "unclosed-tag",
          severity: "error",
          message: 'Unclosed template tag. Expected "}}".',
          start,
          end: template.length,
        });
        textBuffer = template.slice(start);
        cursor = template.length;
        break;
      }

      const rawTag = template.slice(cursor + 2, close).trim();
      cursor = close + 2;
      textStart = cursor;

      if (!rawTag) {
        diagnostics.push({
          code: "empty-tag",
          severity: "error",
          message: "Empty template tag.",
          start,
          end: cursor,
        });
        continue;
      }

      if (rawTag.startsWith("#")) {
        const rawPath = rawTag.slice(1);
        const path = parseTemplatePath(rawPath, start, cursor, diagnostics);
        const childResult = parseNodes(path);

        if (!childResult.closed) {
          diagnostics.push({
            code: "unclosed-section",
            severity: "error",
            message: `Unclosed section "${rawPath.trim()}".`,
            start,
            end: template.length,
          });
        }

        nodes.push({
          type: "section",
          path,
          raw: rawPath.trim(),
          children: childResult.nodes,
          start,
          end: cursor,
        });
        continue;
      }

      if (rawTag.startsWith("/")) {
        const rawPath = rawTag.slice(1);
        const path = parseTemplatePath(rawPath, start, cursor, diagnostics);

        if (!expectedSectionPath) {
          diagnostics.push({
            code: "unexpected-section-close",
            severity: "error",
            message: `Unexpected section close "${rawPath.trim()}".`,
            start,
            end: cursor,
          });
          continue;
        }

        const expected = expectedSectionPath.join(".");
        const actual = path.join(".");
        if (expected !== actual) {
          diagnostics.push({
            code: "mismatched-section-close",
            severity: "error",
            message: `Mismatched section close "${actual}". Expected "${expected}".`,
            start,
            end: cursor,
          });
        }

        return { closed: true, nodes };
      }

      const path = parseTemplatePath(rawTag, start, cursor, diagnostics);
      nodes.push({
        type: "value",
        path,
        raw: rawTag,
        start,
        end: cursor,
      });
    }

    flushText();
    return { closed: false, nodes };
  };

  const parsed = parseNodes();
  return { diagnostics, nodes: parsed.nodes };
}

export function stringifyCitationTemplate(nodes: CitationTemplateNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") {
        return node.value;
      }

      if (node.type === "value") {
        return `{{${node.path.join(".")}}}`;
      }

      return `{{#${node.path.join(".")}}}${stringifyCitationTemplate(
        node.children,
      )}{{/${node.path.join(".")}}}`;
    })
    .join("");
}

function renderNodes(
  nodes: TemplateNode[],
  context: CitationTemplateContext,
  diagnostics: CitationTemplateDiagnostic[],
): RenderedNodes {
  let hasBlockingIssue = false;
  let text = "";

  for (const node of nodes) {
    if (node.type === "text") {
      text += node.value;
      continue;
    }

    if (node.type === "value") {
      const resolved = resolveTemplatePath(context.values, node.path);
      if (!resolved.exists) {
        diagnostics.push({
          code: "unknown-variable",
          severity: "error",
          message: `Unknown template path "${node.raw}".`,
          start: node.start,
          end: node.end,
        });
        hasBlockingIssue = true;
        continue;
      }

      const value = stringifyTemplateValue(resolved.value);
      if (!value) {
        diagnostics.push({
          code: "missing-value",
          severity: "warning",
          message: `Template path "${node.raw}" has no value in the current context.`,
          start: node.start,
          end: node.end,
        });
        hasBlockingIssue = true;
        continue;
      }

      text += value;
      continue;
    }

    const resolved = resolveTemplatePath(context.values, node.path);
    if (!resolved.exists) {
      diagnostics.push({
        code: "unknown-section",
        severity: "error",
        message: `Unknown section path "${node.raw}".`,
        start: node.start,
        end: node.end,
      });
      hasBlockingIssue = true;
      continue;
    }

    if (!hasRenderableValue(resolved.value)) {
      continue;
    }

    const renderedChild = renderNodes(node.children, context, diagnostics);
    if (renderedChild.hasBlockingIssue) {
      continue;
    }

    text += renderedChild.text;
  }

  return {
    hasBlockingIssue,
    text,
  };
}

export function renderCitationTemplate(
  template: string,
  context: CitationTemplateContext,
): CitationTemplateRenderResult {
  const parsed = parseCitationTemplate(template);
  const diagnostics = [...parsed.diagnostics];
  const trimmedTemplate = template.trim();

  if (!trimmedTemplate) {
    diagnostics.push({
      code: "empty-template",
      severity: "warning",
      message: "Template is empty.",
      start: 0,
      end: template.length,
    });
  } else if (!hasTemplateTag(parsed.nodes)) {
    diagnostics.push({
      code: "static-template",
      severity: "warning",
      message:
        "Template has no dynamic tags, so it will always render the same text.",
      start: 0,
      end: template.length,
    });
  }

  const rendered = renderNodes(parsed.nodes, context, diagnostics);
  const text = cleanupCitation(rendered.text);

  if (trimmedTemplate && !text) {
    diagnostics.push({
      code: "empty-output",
      severity: "warning",
      message:
        "Template produced an empty citation for the current sample data.",
      start: 0,
      end: template.length,
    });
  }

  return {
    diagnostics,
    text,
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
  };
}
