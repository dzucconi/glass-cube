import { createAggregator } from "../aggregator";
import {
  schemaFromValue,
  schemaNodeToCode,
  schemaNodeToJSONSchema,
  schemaNodeToTypeScript,
  schemaNodeToZod,
} from "../schemaIR";

describe("createAggregator", () => {
  it("aggregates samples into a stable schema and runtype", () => {
    const aggregator = createAggregator();

    aggregator.add({ foo: "bar", bar: 1 });
    aggregator.add({ foo: "baz", baz: true });

    const result = aggregator.finalize();

    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
    expect(result!.code).toEqual(
      'R.Record({ "bar": R.Number.Or(R.Undefined), "baz": R.Boolean.Or(R.Undefined), "foo": R.String })'
    );

    expect(result!.runtype.validate({ foo: "bar", bar: 1 }).success).toBe(true);
    expect(result!.runtype.validate({ foo: "baz", baz: true }).success).toBe(
      true
    );
    expect(result!.runtype.validate({ foo: false, baz: true }).success).toBe(
      false
    );
  });

  it("tracks field visibility stats in schema IR", () => {
    const aggregator = createAggregator();

    aggregator.addMany([
      { foo: "bar", bar: 1 },
      { foo: "baz" },
      { foo: "qux", bar: 2 },
    ]);

    const result = aggregator.finalize()!;
    const bar = result.schema.fields.bar;

    expect(bar.seen).toBe(2);
    expect(bar.missing).toBe(1);
  });

  it("returns null when finalized without samples", () => {
    const aggregator = createAggregator();
    expect(aggregator.finalize()).toBeNull();
  });

  it("supports requiredFieldThreshold policy", () => {
    const aggregator = createAggregator({ requiredFieldThreshold: 0.5 });

    aggregator.addMany([
      { foo: "bar", bar: 1 },
      { foo: "baz", bar: 2 },
      { foo: "qux" },
    ]);

    const result = aggregator.finalize()!;

    expect(result.code).toEqual(
      'R.Record({ "bar": R.Number, "foo": R.String })'
    );
  });

  it("supports nullHandling policy", () => {
    const preserve = createAggregator({ nullHandling: "preserve" });
    preserve.addMany([{ foo: null }, { foo: "bar" }]);

    const missing = createAggregator({ nullHandling: "missing" });
    missing.addMany([{ foo: null }, { foo: "bar" }]);

    expect(preserve.finalize()!.code).toEqual(
      'R.Record({ "foo": R.Null.Or(R.String) })'
    );
    expect(missing.finalize()!.code).toEqual(
      'R.Record({ "foo": R.String.Or(R.Undefined) })'
    );
  });
});

describe("schemaIR", () => {
  it("infers heterogeneous array members", () => {
    const schema = schemaFromValue([{ foo: "bar" }, { baz: 1 }]);
    expect(schemaNodeToCode(schema)).toEqual(
      'R.Array(R.Record({ "baz": R.Number.Or(R.Undefined), "foo": R.String.Or(R.Undefined) }))'
    );
  });

  it("emits JSON Schema", () => {
    const schema = schemaFromValue({ foo: "bar", bar: null });

    expect(schemaNodeToJSONSchema(schema)).toEqual({
      type: "object",
      properties: {
        bar: { type: "null" },
        foo: { type: "string" },
      },
      required: ["bar", "foo"],
      additionalProperties: false,
    });
  });

  it("emits TypeScript types", () => {
    const schema = schemaFromValue({ foo: "bar", bar: [1, 2, 3] });

    expect(schemaNodeToTypeScript(schema)).toEqual(
      '{ "bar": Array<number>; "foo": string; }'
    );
  });

  it("emits Zod schemas", () => {
    const schema = schemaFromValue({ foo: "bar", bar: [1, 2, 3] });

    expect(schemaNodeToZod(schema)).toEqual(
      'z.object({ "bar": z.array(z.number()), "foo": z.string() })'
    );
  });

  it("honors requiredFieldThreshold for JSON Schema and TypeScript emitters", () => {
    const aggregator = createAggregator({ requiredFieldThreshold: 0.5 });
    aggregator.addMany([
      { foo: "bar", bar: 1 },
      { foo: "baz", bar: 2 },
      { foo: "qux" },
    ]);

    const result = aggregator.finalize()!;

    expect(schemaNodeToJSONSchema(result.schema, { requiredFieldThreshold: 0.5 }))
      .toEqual({
        type: "object",
        properties: {
          bar: { type: "number" },
          foo: { type: "string" },
        },
        required: ["bar", "foo"],
        additionalProperties: false,
      });

    expect(
      schemaNodeToTypeScript(result.schema, { requiredFieldThreshold: 0.5 })
    ).toEqual('{ "bar": number; "foo": string; }');

    expect(
      schemaNodeToZod(result.schema, { requiredFieldThreshold: 0.5 })
    ).toEqual('z.object({ "bar": z.number(), "foo": z.string() })');
  });
});
