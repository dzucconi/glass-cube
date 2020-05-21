import * as R from "runtypes";
import { uniqBy, flattenDeep } from "lodash";

const flattenUnions = (alternatives: any) => {
  return flattenDeep(
    alternatives.map((element: any) => {
      if (element.tag === "union") {
        return flattenUnions(element.alternatives);
      }
      return element;
    })
  );
};

const mergeWithUnion = (union: R.Union2<any, any>, element: any) => {
  const alternatives = flattenUnions([...union.alternatives, element]);
  // @ts-ignore
  return R.Union(...uniqBy(alternatives, (element) => element.tag));
};

const mergeFields = (
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
        (element: any) =>
          element.tag === "literal" && element.value === undefined
      )
    ) {
      return { ...acc, [key]: leftValue };
    }

    // If the key is completely missing, union with undefined
    if (rightValue === undefined) {
      return { ...acc, [key]: R.Union(leftValue, R.Undefined) };
    }

    // Both records, then recursively merge
    if (rightValue.tag === "record" && leftValue.tag === "record") {
      return { ...acc, [key]: mergeRuntypes(rightValue, leftValue) };
    }

    // TODO: Handle unknowns by leaving them alone until we determine the type
    if (rightValue.tag === "unknown") {
      console.log("unknown!");
    }

    // Both unions, then flatten them out and unique the values into a new union
    if (rightValue.tag === "union" && leftValue.tag === "union") {
      const alternatives = flattenUnions([
        ...leftValue.alternatives,
        ...rightValue.alternatives,
      ]);

      const union = uniqBy(alternatives, (element: any) => element.tag);

      // @ts-ignore
      return { ...acc, [key]: R.Union(...union) };
    }

    if (rightValue.tag === "union") {
      return { ...acc, [key]: mergeWithUnion(rightValue, leftValue) };
    }

    if (leftValue.tag === "union") {
      return { ...acc, [key]: mergeWithUnion(leftValue, rightValue) };
    }

    // Same value but not unions, just return the left
    if (leftValue.tag === rightValue.tag) {
      return { ...acc, [key]: leftValue };
    }

    return { ...acc, [key]: R.Union(leftValue, rightValue) };
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
