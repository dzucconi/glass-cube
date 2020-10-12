import * as R from "runtypes";
import { uniqBy, flattenDeep, uniq } from "lodash";
import {
  Element,
  UnionElement,
  RecordElement,
  ArrayElement,
} from "./runtypeToCode";

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

const isUnion = (element: Element): element is UnionElement =>
  element.tag === "union";

const isUndefined = (element: Element) =>
  element.tag === "literal" && element.value === undefined;

const isMissing = (element?: Element): element is undefined =>
  element === undefined;

const isRecord = (element: Element): element is RecordElement =>
  element.tag === "record";

const isArray = (element: Element): element is ArrayElement =>
  element.tag === "array";

const isUnknownArray = (
  element: Element
): element is R.Array<R.Unknown, false> =>
  isArray(element) && element.element.tag === "unknown";

const isEquivalent = (leftElement: Element, rightElement: Element) =>
  pluckTag(leftElement) === pluckTag(rightElement);

export const mergeElements = (
  left: Record<string, any>,
  right: Record<string, any>
): {} => {
  return Object.keys(left).reduce((acc, key) => {
    const rightElement: Element = right[key];
    const leftElement: Element = left[key];

    // If the key is completely missing but we've already got a union with
    // a literal undefined in it, return the union:
    if (
      isMissing(rightElement) &&
      isUnion(leftElement) &&
      leftElement.alternatives.some(isUndefined)
    ) {
      return { ...acc, [key]: leftElement };
    }

    // If the key is completely missing, union with undefined:
    if (isMissing(rightElement)) {
      return { ...acc, [key]: flatten(leftElement, R.Undefined) };
    }

    // Both records? Then recursively merge:
    if (isRecord(rightElement) && isRecord(leftElement)) {
      return { ...acc, [key]: mergeRuntypes(rightElement, leftElement) };
    }

    // Both unions, then flatten them out and unique the values into a new union:
    if (isUnion(rightElement) && isUnion(leftElement)) {
      const alternatives = flattenUnions([
        ...leftElement.alternatives,
        ...rightElement.alternatives,
      ]);
      const union = uniqBy(alternatives, (element: Element) => element.tag);
      return { ...acc, [key]: flatten(...union) };
    }

    // Both are arrays but elements of array are still unknown,
    // then just continue and return one of them:
    if ([leftElement, rightElement].every(isUnknownArray)) {
      return { ...acc, [key]: leftElement };
    }

    // Both are arrays, merge, but omit any unknowns:
    if (isArray(leftElement) && isArray(rightElement)) {
      // If one of them is unknown then omit it ...
      const elements: Element[] = [
        leftElement.element,
        rightElement.element,
      ].filter((element) => element.tag !== "unknown");

      // ... and clone over the other element and continue on
      const arrayElements =
        elements.length === 1 ? [elements[0], elements[0]] : elements;

      // If both elements are records, merge them, otherwise merge the fields
      const fn = elements.every(isRecord) ? mergeRuntypes : mergeElements;

      return {
        ...acc,
        // @ts-ignore
        [key]: R.Array(fn(arrayElements[0], arrayElements[1])),
      };
    }

    // If both elements are equivalent, return the left
    if (isEquivalent(leftElement, rightElement)) {
      return { ...acc, [key]: leftElement };
    }

    return { ...acc, [key]: flatten(leftElement, rightElement) };
  }, {});
};

export const mergeRuntypes = (left: RecordElement, right: RecordElement) => {
  return R.Record({
    ...mergeElements(left.fields, right.fields),
    ...mergeElements(right.fields, left.fields),
  });
};
