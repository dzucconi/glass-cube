const isString = (value: unknown) => typeof value === "string";

const isNumber = (value: unknown) => typeof value === "number";

const isBoolean = (value: unknown) => typeof value === "boolean";

const isNull = (value: unknown) => value === null;

const isUndefined = (value: unknown) => value === undefined;

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

const isEmptyArray = (value: unknown) => isArray(value) && value.length === 0;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !isArray(value);

const joinOrTypes = (types: string[]) =>
  types.reduce((acc, type) => {
    if (acc === "") return type;
    return `${acc}.Or(${type})`;
  }, "");

export const jsonToCode = (value: unknown): string => {
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

  if (isArray(value)) {
    return `R.Array(${joinOrTypes([...new Set(value.map(jsonToCode))])})`;
  }

  if (!isObject(value)) {
    return "R.Unknown";
  }

  return `R.Record({ ${Object.entries(value)
    .map(([key, value]) => {
      return `${JSON.stringify(key)}: ${jsonToCode(value)}`;
    })
    .join(", ")} })`;
};
