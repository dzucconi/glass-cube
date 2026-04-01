import * as R from "runtypes";

type RuntimeType = any;

class Parser {
  private cursor = 0;

  constructor(private readonly source: string) {}

  private eof() {
    return this.cursor >= this.source.length;
  }

  private peek(length = 1) {
    return this.source.slice(this.cursor, this.cursor + length);
  }

  private skipWhitespace() {
    while (!this.eof() && /\s/.test(this.peek())) {
      this.cursor += 1;
    }
  }

  private consume(value: string): boolean {
    this.skipWhitespace();
    if (this.source.slice(this.cursor, this.cursor + value.length) !== value) {
      return false;
    }
    this.cursor += value.length;
    return true;
  }

  private expect(value: string) {
    if (!this.consume(value)) {
      throw new Error(
        `Unexpected token at position ${this.cursor}, expected "${value}"`
      );
    }
  }

  private parseStringLiteral() {
    this.skipWhitespace();
    const quote = this.peek();

    if (quote !== '"' && quote !== "'") {
      throw new Error(
        `Unexpected token at position ${this.cursor}, expected string key`
      );
    }

    this.cursor += 1;
    let value = "";

    while (!this.eof()) {
      const next = this.peek();

      if (next === quote) {
        this.cursor += 1;
        return value;
      }

      if (next === "\\") {
        this.cursor += 1;
        const escape = this.peek();

        if (escape === "u") {
          const codePoint = this.source.slice(this.cursor + 1, this.cursor + 5);

          if (codePoint.length !== 4 || !/^[0-9a-fA-F]+$/.test(codePoint)) {
            throw new Error(
              `Invalid unicode escape at position ${this.cursor}`
            );
          }

          value += String.fromCharCode(parseInt(codePoint, 16));
          this.cursor += 5;
          continue;
        }

        const escapes: Record<string, string> = {
          "\\": "\\",
          '"': '"',
          "'": "'",
          n: "\n",
          r: "\r",
          t: "\t",
          b: "\b",
          f: "\f",
          v: "\v",
          0: "\0",
        };

        if (!(escape in escapes)) {
          throw new Error(`Invalid escape sequence at position ${this.cursor}`);
        }

        value += escapes[escape];
        this.cursor += 1;
        continue;
      }

      value += next;
      this.cursor += 1;
    }

    throw new Error(`Unterminated string at position ${this.cursor}`);
  }

  private parseNumberLiteral() {
    this.skipWhitespace();
    const start = this.cursor;

    if (this.peek() === "-") {
      this.cursor += 1;
    }

    if (!/\d/.test(this.peek())) {
      this.cursor = start;
      throw new Error(
        `Unexpected token at position ${this.cursor}, expected number literal`
      );
    }

    while (!this.eof() && /\d/.test(this.peek())) {
      this.cursor += 1;
    }

    if (this.peek() === ".") {
      this.cursor += 1;
      if (!/\d/.test(this.peek())) {
        throw new Error(
          `Unexpected token at position ${this.cursor}, expected decimal literal`
        );
      }

      while (!this.eof() && /\d/.test(this.peek())) {
        this.cursor += 1;
      }
    }

    if (this.peek() === "e" || this.peek() === "E") {
      this.cursor += 1;
      if (this.peek() === "+" || this.peek() === "-") {
        this.cursor += 1;
      }

      if (!/\d/.test(this.peek())) {
        throw new Error(
          `Unexpected token at position ${this.cursor}, expected exponent literal`
        );
      }

      while (!this.eof() && /\d/.test(this.peek())) {
        this.cursor += 1;
      }
    }

    return Number(this.source.slice(start, this.cursor));
  }

  private parseLiteralValue(): string | number | boolean | null | undefined {
    this.skipWhitespace();

    if (this.peek() === '"' || this.peek() === "'") {
      return this.parseStringLiteral();
    }

    if (this.consume("true")) {
      return true;
    }

    if (this.consume("false")) {
      return false;
    }

    if (this.consume("null")) {
      return null;
    }

    if (this.consume("undefined")) {
      return undefined;
    }

    return this.parseNumberLiteral();
  }

  private parseRecordFields(): Record<string, RuntimeType> {
    const fields: Record<string, RuntimeType> = {};

    this.expect("{");
    this.skipWhitespace();

    if (this.consume("}")) {
      return fields;
    }

    while (true) {
      const key = this.parseStringLiteral();
      this.expect(":");
      fields[key] = this.parseExpression();

      this.skipWhitespace();
      if (this.consume("}")) {
        break;
      }

      this.expect(",");
    }

    return fields;
  }

  private parsePrimary(): RuntimeType {
    this.skipWhitespace();

    if (this.consume("R.String")) {
      return R.String;
    }

    if (this.consume("R.Number")) {
      return R.Number;
    }

    if (this.consume("R.Boolean")) {
      return R.Boolean;
    }

    if (this.consume("R.Null")) {
      return R.Null;
    }

    if (this.consume("R.Undefined")) {
      return R.Undefined;
    }

    if (this.consume("R.Unknown")) {
      return R.Unknown;
    }

    if (this.consume("R.Literal(")) {
      const literal = this.parseLiteralValue();
      this.expect(")");
      return R.Literal(literal as any);
    }

    if (this.consume("R.Array(")) {
      const element = this.parseExpression();
      this.expect(")");
      return R.Array(element);
    }

    if (this.consume("R.Record(")) {
      const fields = this.parseRecordFields();
      this.expect(")");
      return R.Record(fields);
    }

    if (this.consume("(")) {
      const value = this.parseExpression();
      this.expect(")");
      return value;
    }

    const preview = this.source.slice(this.cursor, this.cursor + 16);
    throw new Error(
      `Unsupported runtype expression at position ${this.cursor}: "${preview}"`
    );
  }

  private parseExpression(): RuntimeType {
    let left = this.parsePrimary();

    while (true) {
      this.skipWhitespace();
      if (!this.consume(".Or(")) {
        break;
      }

      const right = this.parseExpression();
      this.expect(")");
      left = left.Or(right);
    }

    return left;
  }

  public parse(): RuntimeType {
    const parsed = this.parseExpression();
    this.skipWhitespace();

    if (!this.eof()) {
      const next = this.peek();
      throw new Error(
        `Unexpected token at position ${this.cursor}: "${next}"`
      );
    }

    return parsed;
  }
}

export const codeToRuntype = (code: string) => {
  const parser = new Parser(code);
  return parser.parse();
};
