import {
  ObjectFieldNode,
  ObjectSchemaNode,
  SchemaCodegenOptions,
  SchemaNode,
  mergeSchemaNodes,
  schemaNodeToCode,
} from "./schemaIR";

export type SchemaDiffSeverity = "breaking" | "non_breaking" | "changed";

export interface SchemaDiffEntry {
  path: string;
  kind:
    | "field_added"
    | "field_removed"
    | "field_became_required"
    | "field_became_optional"
    | "type_widened"
    | "type_narrowed"
    | "type_changed";
  severity: SchemaDiffSeverity;
  previous?: string;
  next?: string;
  message: string;
}

const resolveRequiredFieldThreshold = (value: number | undefined) => {
  if (value === undefined) return 1;
  if (!Number.isFinite(value)) return 1;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const isRequiredField = (
  field: ObjectFieldNode,
  requiredFieldThreshold: number
) => {
  if (field.seen + field.missing === 0) {
    return false;
  }

  return field.seen / (field.seen + field.missing) >= requiredFieldThreshold;
};

const joinPath = (basePath: string, field: string) =>
  basePath === "$" ? `$.${field}` : `${basePath}.${field}`;

const classifyTypeChange = (
  path: string,
  previousNode: SchemaNode,
  nextNode: SchemaNode
): SchemaDiffEntry | null => {
  const previous = schemaNodeToCode(previousNode);
  const next = schemaNodeToCode(nextNode);

  if (previous === next) {
    return null;
  }

  const merged = mergeSchemaNodes(previousNode, nextNode);
  const mergedCode = schemaNodeToCode(merged);

  if (mergedCode === next) {
    return {
      path,
      kind: "type_widened",
      severity: "non_breaking",
      previous,
      next,
      message: `Type widened at ${path}`,
    };
  }

  if (mergedCode === previous) {
    return {
      path,
      kind: "type_narrowed",
      severity: "breaking",
      previous,
      next,
      message: `Type narrowed at ${path}`,
    };
  }

  return {
    path,
    kind: "type_changed",
    severity: "changed",
    previous,
    next,
    message: `Type changed at ${path}`,
  };
};

const diffObjectNodes = (
  previousSchema: ObjectSchemaNode,
  nextSchema: ObjectSchemaNode,
  path: string,
  requiredFieldThreshold: number
): SchemaDiffEntry[] => {
  const changes: SchemaDiffEntry[] = [];
  const keys = [...new Set([...Object.keys(previousSchema.fields), ...Object.keys(nextSchema.fields)])]
    .sort();

  keys.forEach((key) => {
    const previousField = previousSchema.fields[key];
    const nextField = nextSchema.fields[key];
    const nextPath = joinPath(path, key);

    if (!previousField && nextField) {
      changes.push({
        path: nextPath,
        kind: "field_added",
        severity: "non_breaking",
        next: schemaNodeToCode(nextField.node),
        message: `Field added at ${nextPath}`,
      });
      return;
    }

    if (previousField && !nextField) {
      changes.push({
        path: nextPath,
        kind: "field_removed",
        severity: "breaking",
        previous: schemaNodeToCode(previousField.node),
        message: `Field removed at ${nextPath}`,
      });
      return;
    }

    if (!previousField || !nextField) {
      return;
    }

    const wasRequired = isRequiredField(previousField, requiredFieldThreshold);
    const isRequired = isRequiredField(nextField, requiredFieldThreshold);

    if (wasRequired && !isRequired) {
      changes.push({
        path: nextPath,
        kind: "field_became_optional",
        severity: "non_breaking",
        message: `Field became optional at ${nextPath}`,
      });
    }

    if (!wasRequired && isRequired) {
      changes.push({
        path: nextPath,
        kind: "field_became_required",
        severity: "breaking",
        message: `Field became required at ${nextPath}`,
      });
    }

    if (previousField.node.kind === "object" && nextField.node.kind === "object") {
      changes.push(
        ...diffObjectNodes(
          previousField.node,
          nextField.node,
          nextPath,
          requiredFieldThreshold
        )
      );
      return;
    }

    const typeChange = classifyTypeChange(nextPath, previousField.node, nextField.node);

    if (typeChange) {
      changes.push(typeChange);
    }
  });

  return changes;
};

export const diffSchemas = (
  previousSchema: ObjectSchemaNode,
  nextSchema: ObjectSchemaNode,
  options: SchemaCodegenOptions = {}
): SchemaDiffEntry[] => {
  const requiredFieldThreshold = resolveRequiredFieldThreshold(
    options.requiredFieldThreshold
  );

  return diffObjectNodes(previousSchema, nextSchema, "$", requiredFieldThreshold);
};
