import { createAggregator } from "../aggregator";
import { schemaFromValue, schemaNodeToCode } from "../schemaIR";

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
});

describe("schemaIR", () => {
  it("infers heterogeneous array members", () => {
    const schema = schemaFromValue([{ foo: "bar" }, { baz: 1 }]);
    expect(schemaNodeToCode(schema)).toEqual(
      'R.Array(R.Record({ "baz": R.Number.Or(R.Undefined), "foo": R.String.Or(R.Undefined) }))'
    );
  });
});
