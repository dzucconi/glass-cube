import { codeToRuntype } from "./codeToRuntype";
import { RecordElement } from "./runtypeToCode";
import {
  ObjectSchemaNode,
  SchemaCodegenOptions,
  mergeSchemaNodes,
  schemaFromValue,
  schemaNodeToCode,
} from "./schemaIR";

export interface AggregatorOptions extends SchemaCodegenOptions {
  nullHandling?: "preserve" | "missing";
}

export interface AggregationResult {
  count: number;
  schema: ObjectSchemaNode;
  code: string;
  runtype: RecordElement;
}

export interface SchemaAggregator {
  add(sample: Record<string, unknown>): void;
  addMany(samples: Record<string, unknown>[]): void;
  finalize(): AggregationResult | null;
}

export const createAggregator = (
  options: AggregatorOptions = {}
): SchemaAggregator => {
  const nullHandling = options.nullHandling ?? "preserve";
  let count = 0;
  let schema: ObjectSchemaNode | null = null;

  const normalizeSample = (value: unknown): unknown => {
    if (value === null) {
      return nullHandling === "missing" ? undefined : null;
    }

    if (Array.isArray(value)) {
      return value.map(normalizeSample);
    }

    if (typeof value === "object" && value !== null) {
      return Object.entries(value).reduce((acc, [key, entry]) => {
        const normalized = normalizeSample(entry);

        if (normalized !== undefined) {
          acc[key] = normalized;
        }

        return acc;
      }, {} as Record<string, unknown>);
    }

    return value;
  };

  const add = (sample: Record<string, unknown>) => {
    const normalizedSample = normalizeSample(sample) as Record<string, unknown>;
    const next = schemaFromValue(normalizedSample);

    if (next.kind !== "object") {
      throw new Error("Top-level sample must be an object");
    }

    schema =
      schema === null ? next : (mergeSchemaNodes(schema, next) as ObjectSchemaNode);

    count += 1;
  };

  const addMany = (samples: Record<string, unknown>[]) => {
    samples.forEach(add);
  };

  const finalize = (): AggregationResult | null => {
    if (schema === null) {
      return null;
    }

    const code = schemaNodeToCode(schema, {
      requiredFieldThreshold: options.requiredFieldThreshold,
    });

    return {
      count,
      schema,
      code,
      runtype: codeToRuntype(code),
    };
  };

  return {
    add,
    addMany,
    finalize,
  };
};
