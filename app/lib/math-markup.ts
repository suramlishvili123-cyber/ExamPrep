/**
 * A small, deliberately limited maths markup used by the original question bank.
 *
 * Questions are authored with `$...$` around mathematics, using a LaTeX-like subset.
 * That markup is parsed here into a node tree and rendered as real typeset maths
 * (superscripts, subscripts, radicals with an overline, stacked fractions and proper
 * symbols) rather than being shown to candidates as source code.
 *
 * The subset is intentionally small: everything the bank needs, nothing it does not,
 * so the parser stays fully testable and cannot fail open on unexpected input.
 *
 *   ^x  ^{...}   superscript          _x  _{...}   subscript
 *   \sqrt{...}   radical              \frac{a}{b}  stacked fraction
 *   \text{...}   upright text         \deg \ohm    unit symbols
 *   \pi \theta \alpha \lambda \rho \mu \Delta \Omega
 *   \times \div \cdot \pm \le \ge \ne \approx \to \infty
 *   \sin \cos \tan \log \ln          upright function names
 */

export type MathNode =
  | { type: "text"; value: string; italic: boolean }
  | { type: "sup"; children: MathNode[] }
  | { type: "sub"; children: MathNode[] }
  | { type: "sqrt"; children: MathNode[] }
  | { type: "frac"; numerator: MathNode[]; denominator: MathNode[] }
  | { type: "binom"; upper: MathNode[]; lower: MathNode[] };

const SYMBOLS: Record<string, string> = {
  pi: "π", theta: "θ", alpha: "α", beta: "β", lambda: "λ",
  rho: "ρ", mu: "μ", Delta: "Δ", Omega: "Ω", ohm: "Ω",
  times: "×", div: "÷", cdot: "·", pm: "±", mp: "∓",
  le: "≤", ge: "≥", ne: "≠", approx: "≈", to: "→",
  infty: "∞", deg: "°", propto: "∝", therefore: "∴",
  ldots: "…", cdots: "⋯", int: "∫", sum: "∑", partial: "∂",
  // Escaped literals and spacing.
  "%": "%", "&": "&", "#": "#", "_": "_", "{": "{", "}": "}",
  ",": " ", ";": " ", " ": " ",
};

/** Commands that only affect delimiter sizing; the delimiter itself follows literally. */
const TRANSPARENT = new Set(["left", "right", "displaystyle", "mathrm", "!"]);

/**
 * Every command the parser understands. The question-bank build fails if an authored
 * string uses anything outside this set, so an unknown command can never reach a
 * candidate as bare text (which is how `\ldots` once shipped as "ldots").
 */
export const KNOWN_COMMANDS: ReadonlySet<string> = new Set([
  ...Object.keys(SYMBOLS),
  ...["sqrt", "frac", "binom", "text"],
  ...["sin", "cos", "tan", "log", "ln", "lg", "arcsin", "arccos", "arctan", "cosec", "sec", "cot"],
  ...TRANSPARENT,
]);

const UPRIGHT_WORDS = new Set(["sin", "cos", "tan", "log", "ln", "lg", "arcsin", "arccos", "arctan", "cosec", "sec", "cot"]);

/** Symbols that need breathing room on their right-hand side. */
const OPERATORS = new Set(["times", "div", "cdot", "pm", "mp", "le", "ge", "ne", "approx", "to", "propto"]);

class MathParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(stopAtBrace = false): MathNode[] {
    const nodes: MathNode[] = [];
    let literal = "";
    const flush = (italic: boolean) => {
      if (!literal) return;
      nodes.push({ type: "text", value: literal, italic });
      literal = "";
    };

    while (this.index < this.source.length) {
      const character = this.source[this.index];

      if (character === "}" && stopAtBrace) break;

      if (character === "\\") {
        flush(false);
        const command = this.readCommand();
        if (command === "sqrt") nodes.push({ type: "sqrt", children: this.readGroup() });
        else if (command === "frac") nodes.push({ type: "frac", numerator: this.readGroup(), denominator: this.readGroup() });
        else if (command === "binom") nodes.push({ type: "binom", upper: this.readGroup(), lower: this.readGroup() });
        else if (command === "text") nodes.push(...this.readGroup().map(flattenUpright));
        // \left( and \right) only size the delimiter that follows them.
        else if (TRANSPARENT.has(command)) continue;
        else if (UPRIGHT_WORDS.has(command)) {
          // Operators take a space before their argument, but sit tight against a
          // bracket or an exponent: "sin θ", "sin(x)", "sin^2 x".
          const next = this.source[this.index];
          const spaced = next !== undefined && next !== "(" && next !== "^" && next !== "_";
          nodes.push({ type: "text", value: spaced ? `${command} ` : command, italic: false });
        }
        else if (command in SYMBOLS) {
          // Binary and relational operators keep a space before their right-hand side;
          // letter-like symbols and unit marks sit tight against what follows.
          const next = this.source[this.index];
          const spaced = OPERATORS.has(command) && next !== undefined && next !== " ";
          nodes.push({ type: "text", value: spaced ? `${SYMBOLS[command]} ` : SYMBOLS[command], italic: false });
        }
        // An unknown command is a bug in the authored bank, not something to paper over.
        // It is marked so it is impossible to miss in review, and the build rejects it.
        else nodes.push({ type: "text", value: `⟦\\${command}?⟧`, italic: false });
        continue;
      }

      if (character === "^" || character === "_") {
        flush(false);
        this.index += 1;
        nodes.push({ type: character === "^" ? "sup" : "sub", children: this.readGroup() });
        continue;
      }

      if (character === "{") {
        flush(false);
        nodes.push(...this.readGroup());
        continue;
      }

      // Single Latin letters are variables and are set in italics, as in print.
      if (/[A-Za-z]/.test(character)) {
        const word = /^[A-Za-z]+/.exec(this.source.slice(this.index))?.[0] ?? character;
        flush(false);
        if (UPRIGHT_WORDS.has(word)) nodes.push({ type: "text", value: word, italic: false });
        else for (const letter of word) nodes.push({ type: "text", value: letter, italic: true });
        this.index += word.length;
        continue;
      }

      literal += character;
      this.index += 1;
    }

    flush(false);
    return nodes;
  }

  private readCommand(): string {
    this.index += 1; // consume the backslash
    const match = /^[A-Za-z]+/.exec(this.source.slice(this.index));
    if (!match) {
      const character = this.source[this.index] ?? "";
      this.index += 1;
      return character;
    }
    this.index += match[0].length;
    // As in LaTeX, whitespace directly after a command name terminates it and is not
    // itself printed, so `\pi r^2` sets as one expression rather than "pi r squared".
    while (this.source[this.index] === " ") this.index += 1;
    return match[0];
  }

  /** A braced group, or the single next character when unbraced (as in x^2). */
  private readGroup(): MathNode[] {
    if (this.source[this.index] === "{") {
      this.index += 1;
      const inner = this.parse(true);
      if (this.source[this.index] === "}") this.index += 1;
      return inner;
    }
    if (this.source[this.index] === "\\") {
      const command = this.readCommand();
      if (command in SYMBOLS) return [{ type: "text", value: SYMBOLS[command], italic: false }];
      return [{ type: "text", value: command, italic: false }];
    }
    const character = this.source[this.index];
    if (character === undefined) return [];
    this.index += 1;
    return [{ type: "text", value: character, italic: /[A-Za-z]/.test(character) }];
  }
}

function flattenUpright(node: MathNode): MathNode {
  if (node.type === "text") return { ...node, italic: false };
  return node;
}

export function parseMath(source: string): MathNode[] {
  return new MathParser(source).parse();
}

/** Segments of a mixed string: prose outside `$...$`, maths inside. */
export interface MathSegment {
  math: boolean;
  content: string;
}

export function splitMath(source: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let buffer = "";
  let inMath = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\" && source[index + 1] === "$") {
      buffer += "$";
      index += 1;
      continue;
    }
    if (character === "$") {
      if (buffer) segments.push({ math: inMath, content: buffer });
      buffer = "";
      inMath = !inMath;
      continue;
    }
    buffer += character;
  }
  // An unterminated `$` is treated as prose rather than swallowing the rest of the line.
  if (buffer) segments.push({ math: inMath && source.split("$").length % 2 === 1, content: buffer });
  return segments;
}

/**
 * Plain-text rendering of markup, for alt text, search indexes and CSV export.
 * Uses Unicode superscripts where they exist so the fallback still reads as maths.
 */
const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "-": "⁻", "+": "⁺", "(": "⁽", ")": "⁾", n: "ⁿ",
};

const SUBSCRIPTS: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "-": "₋", "+": "₊", "(": "₍", ")": "₎", n: "ₙ",
};

function nodesToText(nodes: MathNode[], script: "none" | "sup" | "sub" = "none"): string {
  return nodes.map((node) => {
    if (node.type === "text") {
      if (script === "none") return node.value;
      const table = script === "sup" ? SUPERSCRIPTS : SUBSCRIPTS;
      return [...node.value].map((character) => table[character] ?? character).join("");
    }
    if (node.type === "sup") return nodesToText(node.children, "sup");
    if (node.type === "sub") return nodesToText(node.children, "sub");
    if (node.type === "sqrt") return `√(${nodesToText(node.children)})`;
    if (node.type === "binom") return `C(${nodesToText(node.upper)}, ${nodesToText(node.lower)})`;
    // A stacked fraction is unambiguous on screen; written inline it needs brackets
    // whenever either part is a compound expression, or "a + b/c" would be misread.
    const bracket = (value: string) => (/[\s+\-±×÷=<>]/.test(value.trim()) ? `(${value})` : value);
    return `${bracket(nodesToText(node.numerator))}/${bracket(nodesToText(node.denominator))}`;
  }).join("");
}

export function mathToPlainText(source: string): string {
  return splitMath(source)
    .map((segment) => (segment.math ? nodesToText(parseMath(segment.content)) : segment.content))
    .join("");
}

/**
 * Commands used inside `$...$` that the parser does not understand. The bank build and
 * the test suite both require this to be empty for every authored string.
 */
export function unknownCommands(source: string): string[] {
  const found = new Set<string>();
  for (const segment of splitMath(source)) {
    if (!segment.math) continue;
    for (const match of segment.content.matchAll(/\\([A-Za-z]+|.)/g)) {
      if (!KNOWN_COMMANDS.has(match[1])) found.add(match[1]);
    }
  }
  return [...found];
}
