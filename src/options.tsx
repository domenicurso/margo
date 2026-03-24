import {
  ArrowCounterClockwiseIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BracketsCurlyIcon,
  CaretDownIcon,
  CopySimpleIcon,
  ArticleIcon,
  TextTIcon,
  TrashIcon,
  type Icon,
} from "@phosphor-icons/react";
import {
  Component,
  StrictMode,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

import type { CitationSettings } from "./shared/types";

import {
  CITATION_TEMPLATE_PRESET_DEFINITIONS,
  generateCitationResult,
  parseCitationTemplate,
  stringifyCitationTemplate,
  type CitationTemplateNode,
} from "./shared/citation";
import { DEFAULT_SETTINGS, SAMPLE_METADATA } from "./shared/constants";
import { loadCitationSettings, saveCitationSettings } from "./shared/storage";

type NodePath = number[];
type RowKind = "section" | "text" | "value";

const ROW_KIND_OPTIONS: {
  icon: Icon;
  label: string;
  value: RowKind;
}[] = [
  { value: "text", label: "Text", icon: TextTIcon },
  { value: "value", label: "Field", icon: ArticleIcon },
  { value: "section", label: "Only show if", icon: BracketsCurlyIcon },
];

const VARIABLE_OPTIONS = [
  "author",
  "title.plain",
  "title.quoted",
  "site.name",
  "site.domain",
  "date.published.medium",
  "date.published.long",
  "date.accessed.medium",
  "date.accessed.long",
  "url.resolved",
  "url.canonical",
];

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
}[] = [
  { key: "includeAuthor", title: "Author" },
  { key: "includeSiteName", title: "Site name" },
  { key: "includePublishedDate", title: "Published date" },
  { key: "includeAccessDate", title: "Access date" },
  { key: "titleQuotes", title: "Quoted title" },
  { key: "preferCanonicalUrl", title: "Canonical URL" },
];

function getSiteLabel() {
  return SAMPLE_METADATA.siteName ?? new URL(SAMPLE_METADATA.url).hostname;
}

function makeTextNode(value = ""): CitationTemplateNode {
  return {
    type: "text",
    value,
    start: 0,
    end: 0,
  };
}

function makeValueNode(path = "title.quoted"): CitationTemplateNode {
  return {
    type: "value",
    path: path.split("."),
    raw: path,
    start: 0,
    end: 0,
  };
}

function makeSectionNode(path = "author"): CitationTemplateNode {
  return {
    type: "section",
    path: path.split("."),
    raw: path,
    children: [makeValueNode(path)],
    start: 0,
    end: 0,
  };
}

function cloneNode(node: CitationTemplateNode): CitationTemplateNode {
  if (node.type === "section") {
    return {
      ...node,
      path: [...node.path],
      children: node.children.map(cloneNode),
    };
  }

  if (node.type === "value") {
    return {
      ...node,
      path: [...node.path],
    };
  }

  return { ...node };
}

function replaceNodeKind(node: CitationTemplateNode, kind: RowKind): CitationTemplateNode {
  const currentPath = node.type === "text" ? "title.quoted" : node.path.join(".");
  const currentText = node.type === "text" ? node.value : "";

  if (kind === "text") {
    return makeTextNode(currentText);
  }

  if (kind === "value") {
    return makeValueNode(currentPath);
  }

  return makeSectionNode(currentPath);
}

function getChildrenAtPath(nodes: CitationTemplateNode[], path: NodePath): CitationTemplateNode[] {
  if (path.length === 0) {
    return nodes;
  }

  const head = path[0];
  if (typeof head === "undefined") {
    return nodes;
  }

  const node = nodes[head];
  if (!node || node.type !== "section") {
    return [];
  }

  return getChildrenAtPath(node.children, path.slice(1));
}

function setChildrenAtPath(
  nodes: CitationTemplateNode[],
  path: NodePath,
  nextChildren: CitationTemplateNode[],
): CitationTemplateNode[] {
  if (path.length === 0) {
    return nextChildren;
  }

  const head = path[0];
  if (typeof head === "undefined") {
    return nodes;
  }

  return nodes.map((node, index) => {
    if (index !== head || node.type !== "section") {
      return node;
    }

    return {
      ...node,
      children: setChildrenAtPath(node.children, path.slice(1), nextChildren),
    };
  });
}

function updateNodeAtPath(
  nodes: CitationTemplateNode[],
  path: NodePath,
  updater: (node: CitationTemplateNode) => CitationTemplateNode,
) {
  const parentPath = path.slice(0, -1);
  const index = path.at(-1);
  if (typeof index === "undefined") {
    return nodes;
  }

  const siblings = getChildrenAtPath(nodes, parentPath);
  return setChildrenAtPath(
    nodes,
    parentPath,
    siblings.map((node, siblingIndex) =>
      siblingIndex === index ? updater(node) : node,
    ),
  );
}

function insertNodeAtPath(
  nodes: CitationTemplateNode[],
  parentPath: NodePath,
  index: number,
  node: CitationTemplateNode,
) {
  const siblings = getChildrenAtPath(nodes, parentPath);
  return setChildrenAtPath(nodes, parentPath, [
    ...siblings.slice(0, index),
    node,
    ...siblings.slice(index),
  ]);
}

function removeNodeAtPath(nodes: CitationTemplateNode[], path: NodePath) {
  const parentPath = path.slice(0, -1);
  const index = path.at(-1);
  if (typeof index === "undefined") {
    return nodes;
  }

  const siblings = getChildrenAtPath(nodes, parentPath);
  return setChildrenAtPath(
    nodes,
    parentPath,
    siblings.filter((_, siblingIndex) => siblingIndex !== index),
  );
}

function moveNodeAtPath(
  nodes: CitationTemplateNode[],
  path: NodePath,
  direction: -1 | 1,
) {
  const parentPath = path.slice(0, -1);
  const index = path.at(-1);
  if (typeof index === "undefined") {
    return nodes;
  }

  const siblings = [...getChildrenAtPath(nodes, parentPath)];
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= siblings.length) {
    return nodes;
  }

  const current = siblings[index];
  const target = siblings[targetIndex];
  if (!current || !target) {
    return nodes;
  }

  siblings[index] = target;
  siblings[targetIndex] = current;
  return setChildrenAtPath(nodes, parentPath, siblings);
}

function duplicateNodeAtPath(nodes: CitationTemplateNode[], path: NodePath) {
  const parentPath = path.slice(0, -1);
  const index = path.at(-1);
  if (typeof index === "undefined") {
    return nodes;
  }

  const siblings = getChildrenAtPath(nodes, parentPath);
  const current = siblings[index];
  if (!current) {
    return nodes;
  }

  return insertNodeAtPath(nodes, parentPath, index + 1, cloneNode(current));
}

function IconButton(props: {
  disabled?: boolean;
  icon: Icon;
  label: string;
  onClick: () => void;
}) {
  const IconComponent = props.icon;

  return (
    <button
      type="button"
      className={
        props.disabled
          ? "rounded-sm p-1 text-zinc-700"
          : "rounded-sm p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
      }
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <IconComponent size={14} weight="bold" />
    </button>
  );
}

function AddRowControls(props: {
  onAddSection: () => void;
  onAddText: () => void;
  onAddValue: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 items-center">
      <span className="text-xs text-zinc-600">Add</span>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md pr-1.5 pl-1 py-0.5 text-sm text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
        onClick={props.onAddText}
      >
        <TextTIcon size={14} weight="bold" />
        Text
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md pr-1.5 pl-1 py-0.5 text-sm text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
        onClick={props.onAddValue}
      >
        <ArticleIcon size={14} weight="bold" />
        Field
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md pr-1.5 pl-1 py-0.5 text-sm text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
        onClick={props.onAddSection}
      >
        <BracketsCurlyIcon size={14} weight="bold" />
        Group
      </button>
    </div>
  );
}

function InlineKindSelect(props: { value: RowKind; onChange: (value: RowKind) => void }) {
  const option =
    ROW_KIND_OPTIONS.find((item) => item.value === props.value) ??
    ROW_KIND_OPTIONS.find((item) => item.value === "text");

  if (!option) {
    return null;
  }

  const IconComponent = option.icon;

  return (
    <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
      <IconComponent size={15} weight="bold" className="text-zinc-500" />
      <span className="relative inline-flex items-center py-0.5 px-1.5 hover:bg-zinc-900 rounded-md">
        <select
          className="appearance-none bg-transparent pr-6 text-sm text-zinc-300 outline-none"
          value={props.value}
          onChange={(event) => props.onChange(event.currentTarget.value as RowKind)}
        >
          {ROW_KIND_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <CaretDownIcon
          size={12}
          weight="bold"
          className="pointer-events-none absolute right-1.5 text-zinc-600"
        />
      </span>
    </label>
  );
}

function InlineTokenSelect(props: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <span className="relative inline-flex items-center py-0.5 px-1.5 hover:bg-zinc-900 rounded-md">
      <select
        className="appearance-none bg-transparent pr-6 text-sm text-zinc-300 outline-none"
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.value)}
      >
        {VARIABLE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <CaretDownIcon
        size={12}
        weight="bold"
        className="pointer-events-none absolute right-1.5 text-zinc-600"
      />
    </span>
  );
}

function TemplateRow(props: {
  node: CitationTemplateNode;
  path: NodePath;
  siblingCount: number;
  onAddChild: (parentPath: NodePath, node: CitationTemplateNode) => void;
  onDelete: (path: NodePath) => void;
  onDuplicate: (path: NodePath) => void;
  onMove: (path: NodePath, direction: -1 | 1) => void;
  onUpdate: (path: NodePath, node: CitationTemplateNode) => void;
}) {
  const {
    node,
    onAddChild,
    onDelete,
    onDuplicate,
    onMove,
    onUpdate,
    path,
    siblingCount,
  } = props;
  const tokenPath = node.type === "text" ? null : node.path.join(".");
  const rowKind: RowKind = node.type;
  const canMoveUp = path[path.length - 1] !== 0;
  const canMoveDown = path[path.length - 1] !== siblingCount - 1;

  return (
    <div className="flex flex-col gap-1">
      <div className="group relative rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1.5">
        <div className="absolute top-1/2 -translate-y-1/2 right-1.5 z-10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          <div className="flex items-center rounded-md border border-zinc-700 bg-zinc-900 p-0.5">
            <IconButton
              disabled={!canMoveUp}
              icon={ArrowUpIcon}
              label="Move up"
              onClick={() => onMove(path, -1)}
            />
            <IconButton
              disabled={!canMoveDown}
              icon={ArrowDownIcon}
              label="Move down"
              onClick={() => onMove(path, 1)}
            />
            <IconButton
              icon={CopySimpleIcon}
              label="Duplicate row"
              onClick={() => onDuplicate(path)}
            />
            <IconButton
              icon={TrashIcon}
              label="Delete row"
              onClick={() => onDelete(path)}
            />
          </div>
        </div>

        <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-2 pr-24 md:pr-28">
          <InlineKindSelect
            value={rowKind}
            onChange={(value) => onUpdate(path, replaceNodeKind(node, value))}
          />

          {node.type === "text" ? (
            <input
              className="min-w-56 flex-1 border-b border-zinc-800 bg-transparent px-0 py-0.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
              placeholder="Literal text or punctuation"
              value={node.value}
              onChange={(event) =>
                onUpdate(path, {
                  ...node,
                  value: event.currentTarget.value,
                })
              }
            />
          ) : null}

          {node.type === "value" ? (
            <InlineTokenSelect
              value={tokenPath ?? ""}
              onChange={(value) =>
                onUpdate(path, {
                  ...node,
                  path: value.split("."),
                  raw: value,
                })
              }
            />
          ) : null}

          {node.type === "section" ? (
            <InlineTokenSelect
              value={tokenPath ?? ""}
              onChange={(value) =>
                onUpdate(path, {
                  ...node,
                  path: value.split("."),
                  raw: value,
                })
              }
            />
          ) : null}
        </div>
      </div>

      {node.type === "section" ? (
        <div className="ml-4 -my-1 border-l border-zinc-800 pl-3 py-1">
          <div className="flex flex-col gap-1">
            {node.children.map((child, index) => (
              <TemplateRow
                key={`${path.join("-")}-${index}-${child.type}`}
                node={child}
                path={[...path, index]}
                siblingCount={node.children.length}
                onAddChild={onAddChild}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onMove={onMove}
                onUpdate={onUpdate}
              />
            ))}

            <AddRowControls
              onAddSection={() => onAddChild(path, makeSectionNode())}
              onAddText={() => onAddChild(path, makeTextNode())}
              onAddValue={() => onAddChild(path, makeValueNode())}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

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

  const parsedTemplate = useMemo(
    () => parseCitationTemplate(settings.customTemplate),
    [settings.customTemplate],
  );
  const parseErrors = parsedTemplate.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  );
  const previewResult = useMemo(
    () => generateCitationResult(SAMPLE_METADATA, settings),
    [settings],
  );
  const activePreset =
    CITATION_TEMPLATE_PRESET_DEFINITIONS.find(
      (preset) =>
        settings.style === preset.style &&
        settings.customTemplate === preset.template,
    ) ?? null;

  const updateTemplateFromNodes = (nodes: CitationTemplateNode[]) => {
    setSettings((current) => ({
      ...current,
      style: "custom",
      customTemplate: stringifyCitationTemplate(nodes),
    }));
  };

  const handleNodeUpdate = (path: NodePath, nextNode: CitationTemplateNode) => {
    updateTemplateFromNodes(
      updateNodeAtPath(parsedTemplate.nodes, path, () => nextNode),
    );
  };

  const handleNodeDelete = (path: NodePath) => {
    updateTemplateFromNodes(removeNodeAtPath(parsedTemplate.nodes, path));
  };

  const handleNodeMove = (path: NodePath, direction: -1 | 1) => {
    updateTemplateFromNodes(moveNodeAtPath(parsedTemplate.nodes, path, direction));
  };

  const handleNodeDuplicate = (path: NodePath) => {
    updateTemplateFromNodes(duplicateNodeAtPath(parsedTemplate.nodes, path));
  };

  const handleAddChild = (parentPath: NodePath, node: CitationTemplateNode) => {
    const siblings = getChildrenAtPath(parsedTemplate.nodes, parentPath);
    updateTemplateFromNodes(
      insertNodeAtPath(parsedTemplate.nodes, parentPath, siblings.length, node),
    );
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
              Settings
            </h1>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            onClick={() => setSettings(DEFAULT_SETTINGS)}
          >
            <ArrowCounterClockwiseIcon size={16} weight="fill" />
            Reset
          </button>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-1">
          <div className="flex flex-wrap gap-px">
            {CITATION_TEMPLATE_PRESET_DEFINITIONS.map((preset) => {
              const selected = activePreset?.style === preset.style;

              return (
                <button
                  key={preset.style}
                  type="button"
                  className={
                    selected
                      ? "rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950"
                      : "rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                  }
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      style: preset.style,
                      customTemplate: preset.template,
                    }))
                  }
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="sticky top-4 z-10 rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-zinc-100">
                {SAMPLE_METADATA.title}
              </p>
              <p className="truncate text-xs text-zinc-400">{getSiteLabel()}</p>
            </div>
          </div>

          <div className="h-px w-full bg-zinc-800" />

          <div className="space-y-3 p-3">
            <p className="text-sm leading-relaxed wrap-break-word text-zinc-100">
              {previewResult.citation || "Preview unavailable."}
            </p>

            {previewResult.diagnostics.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3">
                {previewResult.diagnostics.map((diagnostic, index) => (
                  <p
                    className={
                      diagnostic.severity === "error"
                        ? "text-sm leading-6 text-rose-300"
                        : "text-sm leading-6 text-amber-300"
                    }
                    key={`${diagnostic.code}-${diagnostic.start}-${index}`}
                  >
                    {diagnostic.message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="pb-3">
            <h2 className="text-sm font-medium text-zinc-100">Citation</h2>
          </div>

          {parseErrors.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-rose-500/30 bg-rose-950/20 p-4">
              {parseErrors.map((diagnostic, index) => (
                <p
                  className="text-sm leading-6 text-rose-300"
                  key={`${diagnostic.code}-${diagnostic.start}-${index}`}
                >
                  {diagnostic.message}
                </p>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900"
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    style: activePreset?.style ?? DEFAULT_SETTINGS.style,
                    customTemplate:
                      activePreset?.template ?? DEFAULT_SETTINGS.customTemplate,
                  }))
                }
              >
                <ArrowCounterClockwiseIcon size={14} weight="bold" />
                Reset to a working template
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {parsedTemplate.nodes.map((node, index) => (
                <TemplateRow
                  key={`${index}-${node.type}`}
                  node={node}
                  path={[index]}
                  siblingCount={parsedTemplate.nodes.length}
                  onAddChild={handleAddChild}
                  onDelete={handleNodeDelete}
                  onDuplicate={handleNodeDuplicate}
                  onMove={handleNodeMove}
                  onUpdate={handleNodeUpdate}
                />
              ))}

              <AddRowControls
                onAddSection={() => handleAddChild([], makeSectionNode())}
                onAddText={() => handleAddChild([], makeTextNode())}
                onAddValue={() => handleAddChild([], makeValueNode())}
              />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="flex flex-wrap gap-2 p-3">
            {TOGGLE_OPTIONS.map((option) => (
              <label
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-400"
                key={option.key}
              >
                <input
                  type="checkbox"
                  className="size-3.5 accent-zinc-100"
                  checked={settings[option.key]}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setSettings((current) => ({
                      ...current,
                      [option.key]: checked,
                      }));
                  }}
                />
                <span>{option.title}</span>
              </label>
            ))}
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
            <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-lg font-medium text-zinc-100">
                Settings page error
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Reload the extension page once. If it still fails, the stored
                settings payload no longer matches the current template schema.
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
