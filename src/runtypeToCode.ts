import * as R from "runtypes";

export type Node =
  | R.String
  | R.Number
  | R.Boolean
  | R.Literal<null | undefined>
  | R.Array<Node, false>
  | R.Union2<any, any>
  | R.Unknown
  | R.Record<Record<string, Node>, false>;

export const runtypeToCode = (value: Node): string => {
  if (value.tag === "string") {
    return "R.String";
  }

  if (value.tag === "number") {
    return "R.Number";
  }

  if (value.tag === "boolean") {
    return "R.Boolean";
  }

  if (value.tag === "literal" && value.value === null) {
    return "R.Null";
  }

  if (value.tag === "literal" && value.value === undefined) {
    return "R.Undefined";
  }

  if (value.tag === "literal") {
    return "R.Unknown"; // Unsupported
  }

  if (value.tag === "unknown") {
    return "R.Unknown";
  }

  if (value.tag === "array") {
    return `R.Array(${runtypeToCode(value.element)})`;
  }

  if (value.tag === "union") {
    return value.alternatives.reduce((acc, element) => {
      if (acc === "") return runtypeToCode(element);
      return `${acc}.Or(${runtypeToCode(element)})`;
    }, "");
  }

  return `R.Record({ ${Object.entries(value.fields)
    .map(([key, value]) => {
      return `${key}: ${runtypeToCode(value)}`;
    })
    .join(", ")} })`;
};
