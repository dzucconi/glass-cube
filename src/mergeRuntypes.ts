import * as R from "runtypes";
import {
  Element,
  RecordElement,
  ArrayElement,
} from "./runtypeToCode";

export const flattenUnions = (alternatives: Element[]): Element[] => {
  return alternatives.reduce((acc: Element[], element) => {
    if (element.tag === "union") {
      return acc.concat(flattenUnions(element.alternatives));
    }

    return acc.concat(element);
  }, []);
};

export const pluckTag = (element: Element) =>
  element.tag === "literal" ? `${element.tag}:${element.value}` : element.tag;

const isRecord = (element: Element): element is RecordElement =>
  element.tag === "record";

const isArray = (element: Element): element is ArrayElement =>
  element.tag === "array";

const flattenElements = (elements: Element[]) =>
  elements.reduce((acc: Element[], element) => {
    if (element.tag === "union") {
      return acc.concat(flattenUnions(element.alternatives));
    }

    return acc.concat(element);
  }, []);

const mergeArrays = (left: ArrayElement, right: ArrayElement): ArrayElement => {
  if (left.element.tag === "unknown") {
    return right;
  }

  if (right.element.tag === "unknown") {
    return left;
  }

  // @ts-ignore
  return R.Array(flatten(left.element, right.element));
};

const toElement = (elements: Element[]): Element => {
  if (elements.length === 0) {
    return R.Unknown;
  }

  if (elements.length === 1) {
    return elements[0];
  }

  // @ts-ignore
  return R.Union(...elements);
};

export const flatten = (...elements: Element[]): Element => {
  const merged: Element[] = [];
  const seen = new Set<string>();

  flattenElements(elements).forEach((element) => {
    if (isRecord(element)) {
      const index = merged.findIndex(isRecord);

      if (index === -1) {
        merged.push(element);
      } else {
        merged[index] = mergeRuntypes(merged[index] as RecordElement, element);
      }

      return;
    }

    if (isArray(element)) {
      const index = merged.findIndex(isArray);

      if (index === -1) {
        merged.push(element);
      } else {
        merged[index] = mergeArrays(merged[index] as ArrayElement, element);
      }

      return;
    }

    const key = pluckTag(element);

    if (!seen.has(key)) {
      merged.push(element);
      seen.add(key);
    }
  });

  return toElement(merged);
};

const mergeElement = (
  leftElement: Element | undefined,
  rightElement: Element | undefined
): Element => {
  if (leftElement === undefined && rightElement === undefined) {
    return R.Undefined;
  }

  if (leftElement === undefined) {
    return flatten(rightElement as Element, R.Undefined);
  }

  if (rightElement === undefined) {
    return flatten(leftElement, R.Undefined);
  }

  return flatten(leftElement, rightElement);
};

export const mergeElements = (
  left: Record<string, any>,
  right: Record<string, any>
): Record<string, Element> => {
  return Object.keys(left).reduce((acc, key) => {
    acc[key] = mergeElement(left[key], right[key]);
    return acc;
  }, {} as Record<string, Element>);
};

export const mergeRuntypes = (left: RecordElement, right: RecordElement) => {
  return R.Record({
    ...mergeElements(left.fields, right.fields),
    ...mergeElements(right.fields, left.fields),
  });
};
