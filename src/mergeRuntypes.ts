import * as R from "runtypes";
import { uniqBy, flattenDeep } from "lodash";
import { Element } from "./runtypeToCode";

export const flattenUnions = (alternatives: Element[]): Element[] => {
  return flattenDeep(
    alternatives.map((element) => {
      if (element.tag === "union") {
        return flattenUnions(element.alternatives);
      }

      return element;
    })
  );
};

export const pluckTag = (element: Element) =>
  element.tag === "literal" ? `${element.tag}:${element.value}` : element.tag;

export const flatten = (...elements: Element[]) => {
  const flattened = flattenDeep(
    elements.map((element) =>
      element.tag === "union" ? flattenUnions(element.alternatives) : [element]
    )
  );

  // @ts-ignore
  return R.Union(...uniqBy(flattened, pluckTag));
};

export const mergeFields = (
  left: Record<string, any>,
  right: Record<string, any>
): {} => {
  return Object.keys(left).reduce((acc, key) => {
    const rightValue = right[key];
    const leftValue = left[key];

    // If the key is completely missing but we've already got a union with a literal undefined in it, return the union
    if (
      rightValue === undefined &&
      leftValue.tag === "union" &&
      leftValue.alternatives.some(
        (element: Element) =>
          element.tag === "literal" && element.value === undefined
      )
    ) {
      return { ...acc, [key]: leftValue };
    }

    // If the key is completely missing, union with undefined
    if (rightValue === undefined) {
      return { ...acc, [key]: flatten(leftValue, R.Undefined) };
    }

    // Both records, then recursively merge
    if (rightValue.tag === "record" && leftValue.tag === "record") {
      return { ...acc, [key]: mergeRuntypes(rightValue, leftValue) };
    }

    // Both unions, then flatten them out and unique the values into a new union
    if (rightValue.tag === "union" && leftValue.tag === "union") {
      const alternatives = flattenUnions([
        ...leftValue.alternatives,
        ...rightValue.alternatives,
      ]);
      const union = uniqBy(alternatives, (element: Element) => element.tag);
      return { ...acc, [key]: flatten(...union) };
    }

    if (rightValue.tag === "union") {
      return { ...acc, [key]: flatten(rightValue, leftValue) };
    }

    if (leftValue.tag === "union") {
      return { ...acc, [key]: flatten(leftValue, rightValue) };
    }

    // Both are arrays but elements of array are still unknown, then just continue and return one of them
    if (
      leftValue.tag === "array" &&
      rightValue.tag === "array" &&
      [leftValue.element, rightValue.element].every(
        (element) => element.tag === "unknown"
      )
    ) {
      return { ...acc, [key]: leftValue };
    }

    // Both are arrays, merge, but omit any unknowns (unless it's still unknown)
    if (leftValue.tag === "array" && rightValue.tag === "array") {
      // If one of them is unknown then omit it ...
      const elements = [leftValue.element, rightValue.element].filter(
        (element) => element.tag !== "unknown"
      );

      // ... and clone over the other element and continue on
      const arrayElements =
        elements.length === 1 ? [elements[0], elements[0]] : elements;

      // If both elements are records, merge them, otherwise merge the fields
      const fn = elements.every((element) => element.tag === "record")
        ? mergeRuntypes
        : mergeFields;

      return {
        ...acc,
        // @ts-ignore
        [key]: R.Array(fn(arrayElements[0], arrayElements[1])),
      };
    }

    // Same value but not unions, just return the left
    if (leftValue.tag === rightValue.tag) {
      return { ...acc, [key]: leftValue };
    }

    return { ...acc, [key]: flatten(leftValue, rightValue) };
  }, {});
};

export const mergeRuntypes = (
  left: R.Record<Record<string, any>, false>,
  right: R.Record<Record<string, any>, false>
) => {
  return R.Record({
    ...mergeFields(left.fields, right.fields),
    ...mergeFields(right.fields, left.fields),
  });
};
