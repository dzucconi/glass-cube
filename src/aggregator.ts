import { codeToRuntype } from "./codeToRuntype";
import { RecordElement } from "./runtypeToCode";
import {
  ObjectSchemaNode,
  mergeSchemaNodes,
  schemaFromValue,
  schemaNodeToCode,
} from "./schemaIR";

export interface AggregatorOptions {}

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
  _options: AggregatorOptions = {}
): SchemaAggregator => {
  let count = 0;
  let schema: ObjectSchemaNode | null = null;

  const add = (sample: Record<string, unknown>) => {
    const next = schemaFromValue(sample);

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

    const code = schemaNodeToCode(schema);

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
