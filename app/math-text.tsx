"use client";

import { Fragment, type ReactNode } from "react";
import { parseMath, splitMath, type MathNode } from "./lib/math-markup";

const SPOKEN_SYMBOLS: Readonly<Record<string, string>> = {
  "π": "pi",
  "θ": "theta",
  "α": "alpha",
  "β": "beta",
  "λ": "lambda",
  "ρ": "rho",
  "μ": "mu",
  "Δ": "capital delta",
  "Ω": "omega",
  "×": "times",
  "÷": "divided by",
  "·": "times",
  "±": "plus or minus",
  "∓": "minus or plus",
  "≤": "less than or equal to",
  "≥": "greater than or equal to",
  "≠": "not equal to",
  "≈": "approximately equal to",
  "→": "approaches",
  "∞": "infinity",
  "°": "degrees",
  "∝": "is proportional to",
  "∴": "therefore",
  "…": "ellipsis",
  "⋯": "ellipsis",
  "∫": "integral",
  "∑": "sum",
  "∂": "partial",
  "=": "equals",
  "+": "plus",
  "-": "minus",
  "−": "minus",
  "<": "less than",
  ">": "greater than",
  "/": "divided by",
  "*": "times",
  "%": "percent",
  "(": "open parenthesis",
  ")": "close parenthesis",
  "[": "open bracket",
  "]": "close bracket",
  "|": "vertical bar",
};

function normaliseSpeech(value: string): string {
  return value
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function speakText(value: string): string {
  return normaliseSpeech(
    [...value]
      .map((character) => SPOKEN_SYMBOLS[character] ? ` ${SPOKEN_SYMBOLS[character]} ` : character)
      .join(""),
  );
}

/**
 * A deterministic linearisation for assistive technology. The visual renderer below
 * deliberately uses stacked fractions and drawn radicals, neither of which conveys
 * its mathematical relationship through text nodes alone.
 */
function speakNodes(nodes: MathNode[]): string {
  return normaliseSpeech(nodes.map((node) => {
    switch (node.type) {
      case "text":
        return speakText(node.value);
      case "sup": {
        const exponent = speakNodes(node.children);
        if (exponent === "2") return "squared";
        if (exponent === "3") return "cubed";
        return `to the power of ${exponent}, end power`;
      }
      case "sub":
        return `subscript ${speakNodes(node.children)}, end subscript`;
      case "sqrt":
        return `square root of ${speakNodes(node.children)}, end square root`;
      case "frac":
        return `fraction with numerator ${speakNodes(node.numerator)}, and denominator ${speakNodes(node.denominator)}, end fraction`;
      case "binom":
        return `${speakNodes(node.upper)} choose ${speakNodes(node.lower)}`;
    }
  }).join(" "));
}

function Bracket({ side }: { side: "left" | "right" }) {
  return (
    <svg className="math-paren" viewBox="0 0 6 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d={side === "left" ? "M4.8 1 C2 6.5, 2 17.5, 4.8 23" : "M1.2 1 C4 6.5, 4 17.5, 1.2 23"} />
    </svg>
  );
}

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
        // The brackets are drawn for the same reason the radical is: a typed "(" is
        // sized by its font, so it never grows to reach around a stacked pair.
        return (
          <span className="math-binom" key={key}>
            <Bracket side="left" />
            <span className="math-binom-stack">
              <span>{renderNodes(node.upper, `${key}-u`)}</span>
              <span>{renderNodes(node.lower, `${key}-l`)}</span>
            </span>
            <Bracket side="right" />
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
          ? (() => {
              const nodes = parseMath(segment.content);
              return (
                <span className="math" role="math" aria-label={speakNodes(nodes)} key={index}>
                  {renderNodes(nodes, `m${index}`)}
                </span>
              );
            })()
          : <Fragment key={index}>{segment.content}</Fragment>
      ))}
    </>
  );
}
