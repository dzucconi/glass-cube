const isString = (value: unknown) => typeof value === "string";

const isNumber = (value: unknown) => typeof value === "number";

const isBoolean = (value: unknown) => typeof value === "boolean";

const isNull = (value: unknown) => value === null;

const isUndefined = (value: unknown) => value === undefined;

const isPrimitive = (value: unknown) =>
  isString(value) ||
  isNumber(value) ||
  isBoolean(value) ||
  isNull(value) ||
  isUndefined(value);

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

const isEmptyArray = (value: unknown) => isArray(value) && value.length === 0;

const isPrimitiveArray = (value: unknown) =>
  isArray(value) && value.every(isPrimitive);

export const jsonToCode = (value: any): string => {
  if (isString(value)) {
    return "R.String";
  }

  if (isNumber(value)) {
    return "R.Number";
  }

  if (isBoolean(value)) {
    return "R.Boolean";
  }

  if (isNull(value)) {
    return "R.Null";
  }

  if (isUndefined(value)) {
    return "R.Undefined";
  }

  if (isEmptyArray(value)) {
    return "R.Array(R.Unknown)";
  }

  if (isPrimitiveArray(value)) {
    return `R.Array(${[...new Set(value.map(jsonToCode))].reduce(
      (acc, type) => {
        if (acc === "") return type;
        return `${acc}.Or(${type})`;
      },
      ""
    )})`;
  }

  if (isArray(value)) {
    return `R.Array(${jsonToCode(value[0])})`;
  }

  return `R.Record({ ${Object.entries(value)
    .map(([key, value]) => {
      return `${key}: ${jsonToCode(value)}`;
    })
    .join(", ")} })`;
};
