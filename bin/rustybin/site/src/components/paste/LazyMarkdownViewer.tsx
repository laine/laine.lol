import { lazy, Suspense } from "react";
import { preloadMarkdownViewer } from "./markdown-viewer-loader";
// Keep the stylesheet in the eagerly-loaded CSS (same cascade order as before);
// only the markdown-it / DOMPurify JavaScript is deferred.
import "./markdown-styles.css";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

const LazyViewer = lazy(() =>
  preloadMarkdownViewer().then((m) => ({ default: m.MarkdownViewer }))
);

/**
 * Drop-in replacement for MarkdownViewer that code-splits the markdown
 * renderer (markdown-it + plugins + DOMPurify) out of the page chunks.
 */
export function MarkdownViewer(props: MarkdownViewerProps) {
  return (
    <Suspense fallback={null}>
      <LazyViewer {...props} />
    </Suspense>
  );
}
