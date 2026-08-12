"use client";

import { Fragment, type ReactNode } from "react";
import { parseMath, splitMath, type MathNode } from "./lib/math-markup";

function renderNodes(nodes: MathNode[], keyPrefix: string): ReactNode {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "text":
        return node.italic
          ? <i className="math-var" key={key}>{node.value}</i>
          : <Fragment key={key}>{node.value}</Fragment>;
      case "sup":
        return <sup key={key}>{renderNodes(node.children, key)}</sup>;
      case "sub":
        return <sub key={key}>{renderNodes(node.children, key)}</sub>;
      case "sqrt":
        // The radical sign is drawn, not typed: a glyph never lines up with the bar
        // over the radicand at arbitrary sizes, which is what made surds look broken.
        return (
          <span className="math-sqrt" key={key}>
            <svg className="math-radical" viewBox="0 0 12 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path d="M0.4 13.2 L3.1 13.2 L5.8 22.4 L9.4 1.2 L12 1.2" />
            </svg>
            <span className="math-radicand">{renderNodes(node.children, key)}</span>
          </span>
        );
      case "frac":
        return (
          <span className="math-frac" key={key}>
            <span className="math-num">{renderNodes(node.numerator, `${key}-n`)}</span>
            <span className="math-den">{renderNodes(node.denominator, `${key}-d`)}</span>
          </span>
        );
      case "binom":
        return (
          <span className="math-binom" key={key}>
            <span className="math-paren" aria-hidden="true">(</span>
            <span className="math-binom-stack">
              <span>{renderNodes(node.upper, `${key}-u`)}</span>
              <span>{renderNodes(node.lower, `${key}-l`)}</span>
            </span>
            <span className="math-paren" aria-hidden="true">)</span>
          </span>
        );
    }
  });
}

/**
 * Renders authored text in which mathematics is delimited by `$...$`. Prose outside the
 * delimiters is untouched; mathematics inside is typeset. Plain strings with no `$` pass
 * straight through, so the component is safe to use everywhere.
 */
export function MathText({ children }: { children: string | undefined | null }) {
  if (!children) return null;
  if (!children.includes("$")) return <>{children}</>;
  return (
    <>
      {splitMath(children).map((segment, index) => (
        segment.math
          ? <span className="math" key={index}>{renderNodes(parseMath(segment.content), `m${index}`)}</span>
          : <Fragment key={index}>{segment.content}</Fragment>
      ))}
    </>
  );
}
