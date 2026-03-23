import {
  CopySimpleIcon,
  MinusIcon,
  QuotesIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react";
import {
  StrictMode,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createRoot } from "react-dom/client";

import type {
  CitationSettings,
  PageMetadata,
  WidgetCorner,
  WidgetState,
} from "./shared/types";

import { cn } from "./lib/cn";
import { generateCitation } from "./shared/citation";
import {
  CONTENT_HOST_ID,
  DEFAULT_SETTINGS,
  DEFAULT_WIDGET_STATE,
} from "./shared/constants";
import { openExtensionOptionsPage } from "./shared/extension-api";
import { extractPageMetadata } from "./shared/page-metadata";
import {
  loadCitationSettings,
  loadWidgetState,
  onCitationSettingsChange,
  onWidgetStateChange,
  saveWidgetState,
} from "./shared/storage";

const COLLAPSED_SIZE = { width: 42, height: 108 };
const DEFAULT_EXPANDED_SIZE = { width: 336, height: 320 };
const EDGE_GAP = 8;
const COLLAPSED_EDGE_GAP = 0;
const THROW_DISTANCE = 320;
const THROW_HORIZON_SECONDS = 0.22;
const VELOCITY_SAMPLE_MS = 120;
const MAX_DRAG_SAMPLES = 8;
const EXPANDED_RADIUS = 16;
const COLLAPSED_RADIUS = 8;
const PANEL_BORDER_WIDTH = 1;
const CROSSFADE_DURATION_MS = 220;
const EXPANDED_OFFSCREEN_COLLAPSE_RATIO = 0.35;
const EXPANDED_OFFSCREEN_COLLAPSE_MAX_PX = 120;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isSameWidgetState(left: WidgetState, right: WidgetState) {
  return left.corner === right.corner && left.collapsed === right.collapsed;
}

function getAnchorPosition(
  corner: WidgetCorner,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  collapsed: boolean,
) {
  const xGap = collapsed ? COLLAPSED_EDGE_GAP : EDGE_GAP;

  return {
    left: Math.round(
      corner.endsWith("left") ? xGap : viewport.width - size.width - xGap,
    ),
    top: Math.round(
      corner.startsWith("top")
        ? EDGE_GAP
        : viewport.height - size.height - EDGE_GAP,
    ),
  };
}

function getCornerFromRect(
  rect: DOMRect,
  viewport: { width: number; height: number },
): WidgetCorner {
  const horizontal =
    rect.left + rect.width / 2 < viewport.width / 2 ? "left" : "right";
  const vertical =
    rect.top + rect.height / 2 < viewport.height / 2 ? "top" : "bottom";
  return `${vertical}-${horizontal}` as WidgetCorner;
}

function getPredictedCorner(
  rect: DOMRect,
  velocity: { x: number; y: number },
  viewport: { width: number; height: number },
) {
  const projectedRect = getProjectedRect(rect, velocity);
  const projectedCenterX = projectedRect.left + projectedRect.width / 2;
  const projectedCenterY = projectedRect.top + projectedRect.height / 2;

  const horizontal = projectedCenterX < viewport.width / 2 ? "left" : "right";
  const vertical = projectedCenterY < viewport.height / 2 ? "top" : "bottom";
  return `${vertical}-${horizontal}` as WidgetCorner;
}

function getProjectedRect(rect: DOMRect, velocity: { x: number; y: number }) {
  const offsetX = clamp(
    velocity.x * THROW_HORIZON_SECONDS,
    -THROW_DISTANCE,
    THROW_DISTANCE,
  );
  const offsetY = clamp(
    velocity.y * THROW_HORIZON_SECONDS,
    -THROW_DISTANCE,
    THROW_DISTANCE,
  );

  return {
    left: rect.left + offsetX,
    top: rect.top + offsetY,
    right: rect.right + offsetX,
    bottom: rect.bottom + offsetY,
    width: rect.width,
    height: rect.height,
  };
}

function shouldCollapseExpandedOnRelease(
  rect: ReturnType<typeof getProjectedRect>,
  viewport: { width: number; height: number },
) {
  const overflowLeft = Math.max(0, -rect.left);
  const overflowTop = Math.max(0, -rect.top);
  const overflowRight = Math.max(0, rect.right - viewport.width);
  const overflowBottom = Math.max(0, rect.bottom - viewport.height);
  const horizontalThreshold = Math.min(
    EXPANDED_OFFSCREEN_COLLAPSE_MAX_PX,
    rect.width * EXPANDED_OFFSCREEN_COLLAPSE_RATIO,
  );
  const verticalThreshold = Math.min(
    EXPANDED_OFFSCREEN_COLLAPSE_MAX_PX,
    rect.height * EXPANDED_OFFSCREEN_COLLAPSE_RATIO,
  );

  return (
    overflowLeft >= horizontalThreshold ||
    overflowRight >= horizontalThreshold ||
    overflowTop >= verticalThreshold ||
    overflowBottom >= verticalThreshold
  );
}

function getSurfaceShape(
  collapsed: boolean,
  widgetSide: "left" | "right",
) {
  if (!collapsed) {
    return {
      borderTopLeftRadius: EXPANDED_RADIUS,
      borderTopRightRadius: EXPANDED_RADIUS,
      borderBottomRightRadius: EXPANDED_RADIUS,
      borderBottomLeftRadius: EXPANDED_RADIUS,
      borderLeftWidth: PANEL_BORDER_WIDTH,
      borderRightWidth: PANEL_BORDER_WIDTH,
    };
  }

  const dockedOnLeft = widgetSide === "left";

  return {
    borderTopLeftRadius: dockedOnLeft ? 0 : COLLAPSED_RADIUS,
    borderTopRightRadius: dockedOnLeft ? COLLAPSED_RADIUS : 0,
    borderBottomRightRadius: dockedOnLeft ? COLLAPSED_RADIUS : 0,
    borderBottomLeftRadius: dockedOnLeft ? 0 : COLLAPSED_RADIUS,
    borderLeftWidth: dockedOnLeft ? 0 : PANEL_BORDER_WIDTH,
    borderRightWidth: dockedOnLeft ? PANEL_BORDER_WIDTH : 0,
  };
}

function getExtensionStylesheetHref() {
  const extensionApi = globalThis as typeof globalThis & {
    chrome?: {
      runtime?: {
        getURL(path: string): string;
      };
    };
  };

  return extensionApi.chrome?.runtime?.getURL("app.css") ?? null;
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function useSpringNumber(initialValue: number) {
  const [value, setValue] = useState(initialValue);
  const valueRef = useRef(initialValue);
  const targetRef = useRef(initialValue);
  const velocityRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  const stop = useEffectEvent(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  });

  const setInstant = useEffectEvent((nextValue: number) => {
    stop();
    targetRef.current = nextValue;
    valueRef.current = nextValue;
    velocityRef.current = 0;
    setValue(nextValue);
  });

  const step = useEffectEvent((time: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = time;
    }

    const deltaSeconds = Math.min((time - lastTimeRef.current) / 1000, 0.032);
    lastTimeRef.current = time;

    const current = valueRef.current;
    const target = targetRef.current;
    const displacement = target - current;
    const springForce = displacement * 560;
    const dampingForce = -velocityRef.current * 38;
    const acceleration = springForce + dampingForce;

    const nextVelocity = velocityRef.current + acceleration * deltaSeconds;
    const nextValue = current + nextVelocity * deltaSeconds;

    velocityRef.current = nextVelocity;
    valueRef.current = nextValue;
    setValue(nextValue);

    const isSettled =
      Math.abs(target - nextValue) < 0.5 && Math.abs(nextVelocity) < 5;
    if (isSettled) {
      valueRef.current = target;
      velocityRef.current = 0;
      frameRef.current = null;
      lastTimeRef.current = 0;
      setValue(target);
      return;
    }

    frameRef.current = window.requestAnimationFrame(step);
  });

  const animateTo = useEffectEvent((nextTarget: number) => {
    targetRef.current = nextTarget;
    if (frameRef.current !== null) {
      return;
    }

    lastTimeRef.current = 0;
    frameRef.current = window.requestAnimationFrame(step);
  });

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return {
    value,
    get: () => valueRef.current,
    setInstant,
    animateTo,
    stop,
  };
}

function useTweenNumber(initialValue: number, durationMs = CROSSFADE_DURATION_MS) {
  const [value, setValue] = useState(initialValue);
  const valueRef = useRef(initialValue);
  const startValueRef = useRef(initialValue);
  const targetRef = useRef(initialValue);
  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  const stop = useEffectEvent(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  });

  const setInstant = useEffectEvent((nextValue: number) => {
    stop();
    targetRef.current = nextValue;
    startValueRef.current = nextValue;
    startTimeRef.current = 0;
    valueRef.current = nextValue;
    setValue(nextValue);
  });

  const step = useEffectEvent((time: number) => {
    if (startTimeRef.current === 0) {
      startTimeRef.current = time;
    }

    const progress = clamp((time - startTimeRef.current) / durationMs, 0, 1);
    const easedProgress = easeInOutCubic(progress);
    const nextValue =
      startValueRef.current +
      (targetRef.current - startValueRef.current) * easedProgress;

    valueRef.current = nextValue;
    setValue(nextValue);

    if (progress >= 1) {
      frameRef.current = null;
      startTimeRef.current = 0;
      valueRef.current = targetRef.current;
      setValue(targetRef.current);
      return;
    }

    frameRef.current = window.requestAnimationFrame(step);
  });

  const animateTo = useEffectEvent((nextTarget: number) => {
    if (Math.abs(valueRef.current - nextTarget) < 0.001) {
      setInstant(nextTarget);
      return;
    }

    targetRef.current = nextTarget;
    startValueRef.current = valueRef.current;
    startTimeRef.current = 0;

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = window.requestAnimationFrame(step);
  });

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return {
    value,
    get: () => valueRef.current,
    setInstant,
    animateTo,
    stop,
  };
}

async function copyCitation(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function getSiteLabel(metadata: PageMetadata) {
  return (
    metadata.siteName ?? new URL(metadata.url).hostname.replace(/^www\./, "")
  );
}

function ExpandedContent(props: {
  metadata: PageMetadata;
  citation: string;
  copied: boolean;
  publicationLabel: string;
  onStartDrag: (event: ReactPointerEvent) => void;
  onOpenSettings: () => void;
  onCollapse: () => void;
  onCopyCitation: () => void;
  onRefresh: () => void;
  blockDragStart: (event: ReactPointerEvent) => void;
}) {
  const {
    metadata,
    citation,
    copied,
    onStartDrag,
    onOpenSettings,
    onCollapse,
    onCopyCitation,
    blockDragStart,
  } = props;

  return (
    <div className="flex flex-col gap-2 p-3">
      <div
        className="grid cursor-grab grid-cols-[minmax(0,1fr)_auto] gap-3 select-none active:cursor-grabbing"
        onPointerDown={onStartDrag}
      >
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-base font-semibold text-zinc-100">
            {metadata.title}
          </p>
          <p className="truncate text-xs text-zinc-400">
            {getSiteLabel(metadata)}
          </p>
        </div>

        <div className="flex items-start" onPointerDown={blockDragStart}>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800"
            aria-label="Open settings"
            onClick={onOpenSettings}
          >
            <SlidersHorizontalIcon size={18} weight="fill" />
          </button>
          {/*<button
            type="button"
            className="flex size-8 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800"
            aria-label="Refresh metadata"
            onClick={onRefresh}
          >
            <ArrowsClockwiseIcon size={18} weight="fill" />
          </button>*/}
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800"
            aria-label="Collapse widget"
            onClick={onCollapse}
          >
            <MinusIcon size={18} weight="regular" />
          </button>
        </div>
      </div>

      <div className="h-px w-full bg-zinc-800"></div>

      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed wrap-break-word text-zinc-100">
          {citation}
        </p>

        <div
          className="flex items-center justify-center gap-2"
          onPointerDown={blockDragStart}
        >
          <button
            type="button"
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-950 hover:border-zinc-100 hover:bg-zinc-100"
            onClick={onCopyCitation}
          >
            <CopySimpleIcon size={18} weight="fill" />
            <span>{copied ? "Copied" : "Copy citation"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CollapsedContent(props: {
  onStartDrag: (event: ReactPointerEvent) => void;
  onExpand: () => void;
  onExpandKeyDown: (event: ReactKeyboardEvent) => void;
}) {
  const { onStartDrag, onExpand, onExpandKeyDown } = props;

  return (
    <div
      className="grid size-full cursor-grab place-items-center content-center gap-2 px-2 py-3 text-zinc-100 select-none active:cursor-grabbing"
      role="button"
      tabIndex={0}
      onPointerDown={onStartDrag}
      onClick={onExpand}
      onKeyDown={onExpandKeyDown}
    >
      <QuotesIcon size={18} weight="fill" className="text-zinc-300" />
      <span className="rotate-180 text-sm font-medium text-zinc-300 [writing-mode:vertical-rl]">
        Cite
      </span>
    </div>
  );
}

function ContentApp() {
  const panelRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const widgetStateRef = useRef<WidgetState>(DEFAULT_WIDGET_STATE);
  const pendingWidgetStateRef = useRef<WidgetState | null>(null);
  const isDraggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
    samples: Array<{ x: number; y: number; time: number }>;
  } | null>(null);

  const x = useSpringNumber(0);
  const y = useSpringNumber(0);
  const surfaceWidth = useSpringNumber(DEFAULT_EXPANDED_SIZE.width);
  const surfaceHeight = useSpringNumber(DEFAULT_EXPANDED_SIZE.height);
  const borderTopLeftRadius = useSpringNumber(EXPANDED_RADIUS);
  const borderTopRightRadius = useSpringNumber(EXPANDED_RADIUS);
  const borderBottomRightRadius = useSpringNumber(EXPANDED_RADIUS);
  const borderBottomLeftRadius = useSpringNumber(EXPANDED_RADIUS);
  const borderLeftWidth = useSpringNumber(PANEL_BORDER_WIDTH);
  const borderRightWidth = useSpringNumber(PANEL_BORDER_WIDTH);
  const collapsedOpacity = useTweenNumber(0);
  const expandedOpacity = useTweenNumber(1);

  const [settings, setSettings] = useState<CitationSettings>(DEFAULT_SETTINGS);
  const [widgetState, setWidgetState] =
    useState<WidgetState>(DEFAULT_WIDGET_STATE);
  const [metadata, setMetadata] = useState<PageMetadata>(() =>
    extractPageMetadata(),
  );
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [expandedSize, setExpandedSize] = useState(DEFAULT_EXPANDED_SIZE);

  useEffect(() => {
    widgetStateRef.current = widgetState;
  }, [widgetState]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const measureNode = measureRef.current;
    if (!measureNode) {
      return;
    }

    const updateMeasuredSize = () => {
      const rect = measureNode.getBoundingClientRect();
      setExpandedSize((current) => {
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        if (current.width === width && current.height === height) {
          return current;
        }

        return { width, height };
      });
    };

    updateMeasuredSize();

    const observer = new ResizeObserver(() => {
      updateMeasuredSize();
    });

    observer.observe(measureNode);
    return () => observer.disconnect();
  }, [settings, metadata, copied, viewport.width]);

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const refreshMetadata = useEffectEvent(() => {
    setMetadata(extractPageMetadata());
  });

  const citation = useMemo(
    () => generateCitation(metadata, settings),
    [metadata, settings],
  );

  const getTargetSize = (collapsed: boolean) => {
    return collapsed ? COLLAPSED_SIZE : expandedSize;
  };

  const syncSurfaceVisualState = useEffectEvent(
    (nextState: WidgetState, mode: "instant" | "animate") => {
      const targetSize = getTargetSize(nextState.collapsed);
      const nextSide = nextState.corner.endsWith("left") ? "left" : "right";
      const nextShape = getSurfaceShape(nextState.collapsed, nextSide);

      if (mode === "instant") {
        surfaceWidth.setInstant(targetSize.width);
        surfaceHeight.setInstant(targetSize.height);
        borderTopLeftRadius.setInstant(nextShape.borderTopLeftRadius);
        borderTopRightRadius.setInstant(nextShape.borderTopRightRadius);
        borderBottomRightRadius.setInstant(nextShape.borderBottomRightRadius);
        borderBottomLeftRadius.setInstant(nextShape.borderBottomLeftRadius);
        borderLeftWidth.setInstant(nextShape.borderLeftWidth);
        borderRightWidth.setInstant(nextShape.borderRightWidth);
        collapsedOpacity.setInstant(nextState.collapsed ? 1 : 0);
        expandedOpacity.setInstant(nextState.collapsed ? 0 : 1);
        return;
      }

      surfaceWidth.animateTo(targetSize.width);
      surfaceHeight.animateTo(targetSize.height);
      borderTopLeftRadius.animateTo(nextShape.borderTopLeftRadius);
      borderTopRightRadius.animateTo(nextShape.borderTopRightRadius);
      borderBottomRightRadius.animateTo(nextShape.borderBottomRightRadius);
      borderBottomLeftRadius.animateTo(nextShape.borderBottomLeftRadius);
      borderLeftWidth.animateTo(nextShape.borderLeftWidth);
      borderRightWidth.animateTo(nextShape.borderRightWidth);
      collapsedOpacity.animateTo(nextState.collapsed ? 1 : 0);
      expandedOpacity.animateTo(nextState.collapsed ? 0 : 1);
    },
  );

  const transitionToState = useEffectEvent(
    (nextState: WidgetState, rect?: DOMRect) => {
      pendingWidgetStateRef.current = nextState;

      const currentRect = rect ?? panelRef.current?.getBoundingClientRect();
      if (!currentRect) {
        setWidgetState(nextState);
        syncSurfaceVisualState(nextState, "instant");
        x.setInstant(0);
        y.setInstant(0);
        void saveWidgetState(nextState);
        return;
      }

      const targetAnchor = getAnchorPosition(
        nextState.corner,
        getTargetSize(nextState.collapsed),
        viewport,
        nextState.collapsed,
      );
      x.setInstant(currentRect.left - targetAnchor.left);
      y.setInstant(currentRect.top - targetAnchor.top);
      setWidgetState(nextState);
      syncSurfaceVisualState(nextState, "animate");

      window.requestAnimationFrame(() => {
        x.animateTo(0);
        y.animateTo(0);
      });

      void saveWidgetState(nextState);
    },
  );

  const removeGlobalDragListeners = useEffectEvent(() => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
  });

  const finishDrag = useEffectEvent((pointerId: number) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== pointerId) {
      return;
    }

    removeGlobalDragListeners();
    dragStateRef.current = null;
    isDraggingRef.current = false;

    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) {
      x.setInstant(0);
      y.setInstant(0);
      return;
    }

    const now = performance.now();
    const recentSamples = dragState.samples.filter(
      (sample) => now - sample.time <= VELOCITY_SAMPLE_MS,
    );
    const firstSample = recentSamples[0] ?? dragState.samples[0];
    const lastSample =
      recentSamples[recentSamples.length - 1] ??
      dragState.samples[dragState.samples.length - 1];
    const velocity =
      firstSample && lastSample
        ? {
            x:
              ((lastSample.x - firstSample.x) /
                Math.max(16, lastSample.time - firstSample.time)) *
              1000,
            y:
              ((lastSample.y - firstSample.y) /
                Math.max(16, lastSample.time - firstSample.time)) *
              1000,
          }
        : { x: 0, y: 0 };

    const projectedRect = getProjectedRect(rect, velocity);
    const nextCorner = getPredictedCorner(rect, velocity, viewport);
    const shouldCollapse =
      !widgetStateRef.current.collapsed &&
      shouldCollapseExpandedOnRelease(projectedRect, viewport);

    transitionToState(
      {
        corner: nextCorner,
        collapsed: shouldCollapse ? true : widgetStateRef.current.collapsed,
      },
      rect,
    );
  });

  const handlePointerMove = useEffectEvent((event: PointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextX = dragState.originX + (event.clientX - dragState.startClientX);
    const nextY = dragState.originY + (event.clientY - dragState.startClientY);

    x.setInstant(nextX);
    y.setInstant(nextY);

    if (
      Math.abs(nextX - dragState.originX) > 4 ||
      Math.abs(nextY - dragState.originY) > 4
    ) {
      suppressClickRef.current = true;
    }

    const now = performance.now();
    dragState.samples.push({
      x: event.clientX,
      y: event.clientY,
      time: now,
    });

    while (
      dragState.samples.length > 1 &&
      now - dragState.samples[0].time > VELOCITY_SAMPLE_MS
    ) {
      dragState.samples.shift();
    }

    if (dragState.samples.length > MAX_DRAG_SAMPLES) {
      dragState.samples.shift();
    }
  });

  const handlePointerUp = useEffectEvent((event: PointerEvent) => {
    finishDrag(event.pointerId);
  });

  const startDragging = useEffectEvent((event: ReactPointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    suppressClickRef.current = false;
    isDraggingRef.current = true;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: x.get(),
      originY: y.get(),
      samples: [
        {
          x: event.clientX,
          y: event.clientY,
          time: performance.now(),
        },
      ],
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  });

  useEffect(() => {
    return () => {
      removeGlobalDragListeners();
    };
  }, [removeGlobalDragListeners]);

  useEffect(() => {
    let mounted = true;

    void Promise.all([loadCitationSettings(), loadWidgetState()]).then(
      ([storedSettings, storedWidgetState]) => {
        if (!mounted) {
          return;
        }

        setSettings(storedSettings);
        setWidgetState(storedWidgetState);
        setMetadata(extractPageMetadata());
        x.setInstant(0);
        y.setInstant(0);
        syncSurfaceVisualState(storedWidgetState, "instant");
        setReady(true);
      },
    );

    const stopSettingsListener = onCitationSettingsChange((nextSettings) => {
      setSettings(nextSettings);
      refreshMetadata();
    });

    const stopWidgetListener = onWidgetStateChange((nextWidgetState) => {
      const pendingWidgetState = pendingWidgetStateRef.current;
      if (
        pendingWidgetState &&
        isSameWidgetState(pendingWidgetState, nextWidgetState)
      ) {
        pendingWidgetStateRef.current = null;
        return;
      }

      if (isSameWidgetState(widgetStateRef.current, nextWidgetState)) {
        return;
      }

      setWidgetState(nextWidgetState);
      syncSurfaceVisualState(nextWidgetState, "animate");
      if (!isDraggingRef.current) {
        x.setInstant(0);
        y.setInstant(0);
      }
    });

    return () => {
      mounted = false;
      stopSettingsListener();
      stopWidgetListener();
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    syncSurfaceVisualState(widgetState, "animate");
  }, [expandedSize, ready, widgetState]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const handleLocationChange = () => refreshMetadata();
    const intervalId = window.setInterval(() => {
      if (location.href !== metadata.url || document.title !== metadata.title) {
        refreshMetadata();
      }
    }, 1200);

    window.addEventListener("hashchange", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);

    return () => {
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
      window.clearInterval(intervalId);
    };
  }, [metadata.title, metadata.url, ready]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const surfaceSize = getTargetSize(widgetState.collapsed);
  const anchorPosition = getAnchorPosition(
    widgetState.corner,
    surfaceSize,
    viewport,
    widgetState.collapsed,
  );
  const widgetSide = widgetState.corner.endsWith("left") ? "left" : "right";
  const publicationLabel = metadata.publishedDate
    ? new Date(metadata.publishedDate).toLocaleDateString("en-US")
    : "Not detected";

  const anchorStyle = {
    left: anchorPosition.left,
    top: anchorPosition.top,
    transform: `translate3d(${x.value}px, ${y.value}px, 0)`,
    opacity: ready ? 1 : 0,
  };

  const surfaceStyle = {
    width: surfaceWidth.value,
    height: surfaceHeight.value,
    borderTopLeftRadius: borderTopLeftRadius.value,
    borderTopRightRadius: borderTopRightRadius.value,
    borderBottomRightRadius: borderBottomRightRadius.value,
    borderBottomLeftRadius: borderBottomLeftRadius.value,
    borderTopWidth: PANEL_BORDER_WIDTH,
    borderRightWidth: borderRightWidth.value,
    borderBottomWidth: PANEL_BORDER_WIDTH,
    borderLeftWidth: borderLeftWidth.value,
  };
  const collapsedLayerStyle = {
    width: COLLAPSED_SIZE.width,
    height: COLLAPSED_SIZE.height,
    left:
      widgetSide === "left"
        ? 0
        : Math.max(0, surfaceWidth.value - COLLAPSED_SIZE.width),
    opacity: clamp(collapsedOpacity.value, 0, 1),
    pointerEvents: widgetState.collapsed ? "auto" : "none",
    zIndex: widgetState.collapsed ? 1 : 0,
  } satisfies React.CSSProperties;
  const expandedLayerStyle = {
    width: expandedSize.width,
    height: expandedSize.height,
    opacity: clamp(expandedOpacity.value, 0, 1),
    pointerEvents: widgetState.collapsed ? "none" : "auto",
    zIndex: widgetState.collapsed ? 0 : 1,
  } satisfies React.CSSProperties;

  const blockDragStart = (event: ReactPointerEvent) => {
    event.stopPropagation();
  };

  const handleExpand = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    transitionToState({ ...widgetState, collapsed: false });
  };

  const handleExpandKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleExpand();
    }
  };

  const handleCollapse = () => {
    transitionToState({ ...widgetState, collapsed: true });
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-2147483647 font-sans text-zinc-100">
      <div className="pointer-events-none fixed w-fit" style={anchorStyle}>
        <div
          ref={panelRef}
          className={cn(
            "pointer-events-auto relative flex flex-col overflow-hidden border border-zinc-800 bg-zinc-900",
          )}
          style={surfaceStyle}
        >
          <div className="absolute top-0" aria-hidden={!widgetState.collapsed} style={collapsedLayerStyle}>
            <CollapsedContent
              onStartDrag={startDragging}
              onExpand={handleExpand}
              onExpandKeyDown={handleExpandKeyDown}
            />
          </div>

          <div className="absolute top-0 left-0" aria-hidden={widgetState.collapsed} style={expandedLayerStyle}>
            <ExpandedContent
              metadata={metadata}
              citation={citation}
              copied={copied}
              publicationLabel={publicationLabel}
              onStartDrag={startDragging}
              onOpenSettings={() => openExtensionOptionsPage()}
              onCollapse={handleCollapse}
              onCopyCitation={async () => {
                const didCopy = await copyCitation(citation);
                setCopied(didCopy);
              }}
              onRefresh={() => refreshMetadata()}
              blockDragStart={blockDragStart}
            />
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed -top-2500 -left-2500 w-[min(336px,calc(100vw-24px))] opacity-0 max-[560px]:w-[min(336px,calc(100vw-18px))]">
        <div ref={measureRef}>
          <ExpandedContent
            metadata={metadata}
            citation={citation}
            copied={copied}
            publicationLabel={publicationLabel}
            onStartDrag={() => {}}
            onOpenSettings={() => {}}
            onCollapse={() => {}}
            onCopyCitation={() => {}}
            onRefresh={() => {}}
            blockDragStart={() => {}}
          />
        </div>
      </div>
    </div>
  );
}

function mountContentScript() {
  if (document.getElementById(CONTENT_HOST_ID)) {
    return;
  }

  const host = document.createElement("div");
  host.id = CONTENT_HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });
  const mountNode = document.createElement("div");
  const stylesheetHref = getExtensionStylesheetHref();

  if (stylesheetHref) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = stylesheetHref;
    shadow.append(link);
  }

  shadow.append(mountNode);
  (document.body ?? document.documentElement).append(host);

  createRoot(mountNode).render(
    <StrictMode>
      <ContentApp />
    </StrictMode>,
  );
}

mountContentScript();
