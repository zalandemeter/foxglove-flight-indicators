import { PanelExtensionContext, Time } from "@foxglove/extension";
import { CSSProperties, RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

import { parseMessagePath, getValueAtPath } from "./utils";

type TopicEntry = { message: unknown; receiveTime: Time };

export const STALE_TIMEOUT_SEC = 1;

export const STALE_STYLE: CSSProperties = { opacity: 0.5, filter: "grayscale(1)" };

function timeToSec(t: Time): number {
  return t.sec + t.nsec / 1e9;
}

export function useInstrumentPanel(
  context: PanelExtensionContext,
  messagePaths: string[],
): {
  getValue: (messagePath: string) => number | undefined;
  isStale: (messagePath: string) => boolean;
  containerRef: RefObject<HTMLDivElement>;
  size: string;
} {
  const [latestMessages, setLatestMessages] = useState<Map<string, TopicEntry>>(new Map());
  const [currentTime, setCurrentTime] = useState<Time | undefined>(undefined);
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState("200px");

  useLayoutEffect(() => {
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);
      setCurrentTime(renderState.currentTime);
      const frame = renderState.currentFrame;
      if (frame && frame.length > 0) {
        setLatestMessages((prev) => {
          const next = new Map(prev);
          for (const event of frame) {
            next.set(event.topic, { message: event.message, receiveTime: event.receiveTime });
          }
          return next;
        });
      }
    };
    context.watch("currentFrame");
    context.watch("currentTime");
  }, [context]);

  const pathsKey = messagePaths.join(",");
  useEffect(() => {
    const seen = new Set<string>();
    const topics: string[] = [];
    for (const mp of messagePaths) {
      const parsed = parseMessagePath(mp);
      if (parsed && !seen.has(parsed.topic)) {
        seen.add(parsed.topic);
        topics.push(parsed.topic);
      }
    }
    context.subscribe(topics.map((topic) => ({ topic })));
    setLatestMessages(new Map());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, pathsKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setSize(`${Math.floor(Math.min(width, height)) - 4}px`);
      }
    });
    observer.observe(el);
    return () => { observer.disconnect(); };
  }, []);

  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  return {
    getValue: (messagePath: string) => {
      const parsed = parseMessagePath(messagePath);
      if (!parsed) return undefined;
      const entry = latestMessages.get(parsed.topic);
      if (!entry) return undefined;
      return getValueAtPath(entry.message, parsed.fieldPath);
    },
    isStale: (messagePath: string) => {
      const parsed = parseMessagePath(messagePath);
      if (!parsed) return true;
      const entry = latestMessages.get(parsed.topic);
      if (!entry) return true;
      const nowSec = currentTime != null ? timeToSec(currentTime) : Date.now() / 1000;
      const lastSec = timeToSec(entry.receiveTime);
      return nowSec - lastSec > STALE_TIMEOUT_SEC;
    },
    containerRef,
    size,
  };
}
