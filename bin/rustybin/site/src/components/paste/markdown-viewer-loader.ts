import { useEffect } from "react";

let viewerModule: Promise<typeof import("./MarkdownViewer")> | null = null;

/**
 * Starts loading the markdown renderer (markdown-it + plugins + DOMPurify)
 * without rendering anything. Safe to call repeatedly.
 */
export function preloadMarkdownViewer() {
  viewerModule ??= import("./MarkdownViewer").catch((error) => {
    viewerModule = null; // allow a retry
    throw error;
  });
  return viewerModule;
}

/**
 * Prefetches the markdown renderer once the browser is idle after mount, so
 * it's off the critical path for first paint but ready before it's needed.
 */
export function usePreloadMarkdownViewer() {
  useEffect(() => {
    const preload = () => {
      preloadMarkdownViewer().catch(() => {});
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(preload, 200);
    return () => window.clearTimeout(id);
  }, []);
}
