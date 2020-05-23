import * as R from "runtypes";

export type UnionElement =
  | R.Union1<any>
  | R.Union2<any, any>
  | R.Union3<any, any, any>
  | R.Union4<any, any, any, any>
  | R.Union5<any, any, any, any, any>
  | R.Union6<any, any, any, any, any, any>;

export type RecordElement = R.Record<Record<string, Element>, false>;

export type ArrayElement = R.Array<Element, false>;

export type Element =
  | R.String
  | R.Number
  | R.Boolean
  | R.Unknown
  | R.Literal<null | undefined>
  | ArrayElement
  | UnionElement
  | RecordElement;

export const runtypeToCode = (value: Element): string => {
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
