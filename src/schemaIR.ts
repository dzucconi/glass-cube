export type PrimitiveSchemaNodeKind =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "undefined"
  | "unknown";

export type SchemaNodeKind =
  | PrimitiveSchemaNodeKind
  | "array"
  | "object"
  | "union";

interface BaseSchemaNode {
  kind: SchemaNodeKind;
  samples: number;
}

export interface PrimitiveSchemaNode extends BaseSchemaNode {
  kind: PrimitiveSchemaNodeKind;
}

export interface ArraySchemaNode extends BaseSchemaNode {
  kind: "array";
  element: SchemaNode;
  emptySamples: number;
}

export interface ObjectFieldNode {
  node: SchemaNode;
  seen: number;
  missing: number;
}

export interface ObjectSchemaNode extends BaseSchemaNode {
  kind: "object";
  fields: Record<string, ObjectFieldNode>;
}

export interface UnionSchemaNode extends BaseSchemaNode {
  kind: "union";
  variants: SchemaNode[];
}

export type SchemaNode =
  | PrimitiveSchemaNode
  | ArraySchemaNode
  | ObjectSchemaNode
  | UnionSchemaNode;

export interface SchemaCodegenOptions {
  requiredFieldThreshold?: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const primitiveNode = (kind: PrimitiveSchemaNodeKind): PrimitiveSchemaNode => ({
  kind,
  samples: 1,
});

const schemaKey = (node: SchemaNode): string => {
  if (node.kind === "array") {
    return `array<${schemaKey(node.element)}>`;
  }

  if (node.kind === "object") {
    return `object<{${Object.keys(node.fields)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${schemaKey(node.fields[key].node)}`)
      .join(",")}}>`;
  }

  if (node.kind === "union") {
    return `union<${node.variants.map(schemaKey).sort().join("|")}>`;
  }

  return node.kind;
};

const unionFromNodes = (nodes: SchemaNode[]): SchemaNode => {
  const mergedByKey = new Map<string, SchemaNode>();

  const add = (node: SchemaNode) => {
    if (node.kind === "union") {
      node.variants.forEach(add);
      return;
    }

    const key = schemaKey(node);
    const existing = mergedByKey.get(key);
    mergedByKey.set(key, existing ? mergeSchemaNodes(existing, node) : node);
  };

  nodes.forEach(add);

  const variants = [...mergedByKey.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map((entry) => entry[1]);

  if (variants.length === 0) {
    return { kind: "unknown", samples: 0 };
  }

  if (variants.length === 1) {
    return variants[0];
  }

  return {
    kind: "union",
    samples: variants.reduce((acc, node) => acc + node.samples, 0),
    variants,
  };
};

const mergeObjectNodes = (
  left: ObjectSchemaNode,
  right: ObjectSchemaNode
): ObjectSchemaNode => {
  const fields: Record<string, ObjectFieldNode> = {};
  const keys = new Set([
    ...Object.keys(left.fields),
    ...Object.keys(right.fields),
  ]);

  keys.forEach((key) => {
    const leftField = left.fields[key];
    const rightField = right.fields[key];

    if (leftField && rightField) {
      fields[key] = {
        node: mergeSchemaNodes(leftField.node, rightField.node),
        seen: leftField.seen + rightField.seen,
        missing: leftField.missing + rightField.missing,
      };
      return;
    }

    if (leftField) {
      fields[key] = {
        node: leftField.node,
        seen: leftField.seen,
        missing: leftField.missing + right.samples,
      };
      return;
    }

    if (rightField) {
      fields[key] = {
        node: rightField.node,
        seen: rightField.seen,
        missing: rightField.missing + left.samples,
      };
    }
  });

  return {
    kind: "object",
    samples: left.samples + right.samples,
    fields,
  };
};

const mergeArrayNodes = (
  left: ArraySchemaNode,
  right: ArraySchemaNode
): ArraySchemaNode => {
  const leftIsEmptyUnknown =
    left.element.kind === "unknown" && left.element.samples === 0;

  const rightIsEmptyUnknown =
    right.element.kind === "unknown" && right.element.samples === 0;

  const element = leftIsEmptyUnknown
    ? right.element
    : rightIsEmptyUnknown
      ? left.element
      : mergeSchemaNodes(left.element, right.element);

  return {
    kind: "array",
    samples: left.samples + right.samples,
    emptySamples: left.emptySamples + right.emptySamples,
    element,
  };
};

export const mergeSchemaNodes = (left: SchemaNode, right: SchemaNode): SchemaNode => {
  if (left.kind === "union" || right.kind === "union") {
    return unionFromNodes([left, right]);
  }

  if (left.kind === "object" && right.kind === "object") {
    return mergeObjectNodes(left, right);
  }

  if (left.kind === "array" && right.kind === "array") {
    return mergeArrayNodes(left, right);
  }

  if (left.kind === right.kind) {
    return {
      ...left,
      samples: left.samples + right.samples,
    } as SchemaNode;
  }

  return unionFromNodes([left, right]);
};

export const schemaFromValue = (value: unknown): SchemaNode => {
  if (typeof value === "string") return primitiveNode("string");
  if (typeof value === "number") return primitiveNode("number");
  if (typeof value === "boolean") return primitiveNode("boolean");
  if (value === null) return primitiveNode("null");
  if (value === undefined) return primitiveNode("undefined");

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return {
        kind: "array",
        samples: 1,
        emptySamples: 1,
        element: { kind: "unknown", samples: 0 },
      };
    }

    const element = value
      .map(schemaFromValue)
      .reduce((acc, next) => mergeSchemaNodes(acc, next));

    return {
      kind: "array",
      samples: 1,
      emptySamples: 0,
      element,
    };
  }

  if (isObject(value)) {
    return {
      kind: "object",
      samples: 1,
      fields: Object.entries(value).reduce((acc, [key, entry]) => {
        acc[key] = {
          node: schemaFromValue(entry),
          seen: 1,
          missing: 0,
        };
        return acc;
      }, {} as Record<string, ObjectFieldNode>),
    };
  }

  return primitiveNode("unknown");
};

const unionCode = (parts: string[]) => {
  const unique = [...new Set(parts)];

  if (unique.length === 0) {
    return "R.Unknown";
  }

  return unique.reduce((acc, part) => {
    if (acc === "") return part;
    return `${acc}.Or(${part})`;
  }, "");
};

const resolveRequiredFieldThreshold = (value: number | undefined) => {
  if (value === undefined) {
    return 1;
  }

  if (!Number.isFinite(value)) {
    return 1;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

export const schemaNodeToCode = (
  node: SchemaNode,
  options: SchemaCodegenOptions = {}
): string => {
  const requiredFieldThreshold = resolveRequiredFieldThreshold(
    options.requiredFieldThreshold
  );

  switch (node.kind) {
    case "string":
      return "R.String";
    case "number":
      return "R.Number";
    case "boolean":
      return "R.Boolean";
    case "null":
      return "R.Null";
    case "undefined":
      return "R.Undefined";
    case "unknown":
      return "R.Unknown";
    case "array":
      return `R.Array(${schemaNodeToCode(node.element, options)})`;
    case "union":
      return unionCode(
        node.variants.map((variant) => schemaNodeToCode(variant, options))
      );
    case "object": {
      const fields = Object.keys(node.fields)
        .sort()
        .map((key) => {
          const field = node.fields[key];
          const baseCode = schemaNodeToCode(field.node, options);
          const seenRatio =
            field.seen + field.missing === 0
              ? 0
              : field.seen / (field.seen + field.missing);
          const isRequired = seenRatio >= requiredFieldThreshold;
          const code = isRequired
            ? baseCode
            : unionCode([baseCode, "R.Undefined"]);

          return `${JSON.stringify(key)}: ${code}`;
        });

      return `R.Record({ ${fields.join(", ")} })`;
    }
  }
};
