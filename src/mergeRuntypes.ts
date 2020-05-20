import * as R from "runtypes";

const mergeFields = (
  left: Record<string, any>,
  right: Record<string, any>
): {} => {
  return Object.keys(left).reduce((acc, key) => {
    const rightValue = left[key];
    const leftValue = right[key];

    if (leftValue === undefined) {
      return { ...acc, [key]: R.Union(rightValue, R.Undefined) };
    }

    if (rightValue.tag === "record" && leftValue.tag === "record") {
      return { ...acc, [key]: mergeRuntypes(rightValue, leftValue) };
    }

    // TODO: Handle unknowns by leaving them alone until we determine the type

    if (rightValue.tag === leftValue.tag) {
      return { ...acc, [key]: rightValue };
    }

    return { ...acc, [key]: R.Union(rightValue, leftValue) };
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
