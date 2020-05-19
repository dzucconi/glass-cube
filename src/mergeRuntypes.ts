import * as R from "runtypes";

const mergeFields = (
  fieldsA: Record<string, any>,
  fieldsB: Record<string, any>
): {} => {
  return Object.keys(fieldsA).reduce((acc, key) => {
    const valueA = fieldsA[key];
    const valueB = fieldsB[key];

    if (valueB === undefined) {
      return {
        ...acc,
        [key]: R.Union(valueA, R.Undefined),
      };
    }

    if (valueA.tag === "record" && valueB.tag === "record") {
      return {
        ...acc,
        [key]: mergeRuntypes(valueA, valueB),
      };
    }

    // TODO: Handle unknowns by leaving them alone until we determine the type

    if (valueA.tag === valueB.tag) {
      return {
        ...acc,
        [key]: valueA,
      };
    }

    return {
      ...acc,
      [key]: R.Union(valueA, valueB),
    };
  }, {});
};

export const mergeRuntypes = (
  recordA: R.Record<Record<string, any>, false>,
  recordB: R.Record<Record<string, any>, false>
) => {
  const mergedA = mergeFields(recordA.fields, recordB.fields);
  const mergedB = mergeFields(recordB.fields, recordA.fields);

  return R.Record({ ...mergedA, ...mergedB });
};
