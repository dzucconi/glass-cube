import {
  inferFromSamples,
  parseCLIArgs,
  parseSamplesFromText,
} from "../cli";

describe("cli", () => {
  it("parses CLI args", () => {
    expect(
      parseCLIArgs([
        "--input",
        "responses.jsonl",
        "--format",
        "jsonschema",
        "--required-threshold",
        "0.8",
        "--null-handling",
        "missing",
      ])
    ).toEqual({
      inputPath: "responses.jsonl",
      comparePath: undefined,
      format: "jsonschema",
      requiredFieldThreshold: 0.8,
      nullHandling: "missing",
      outputPath: undefined,
    });
  });

  it("parses JSON arrays, objects, and JSONL", () => {
    expect(parseSamplesFromText('[{"foo":1},{"foo":2}]')).toEqual([
      { foo: 1 },
      { foo: 2 },
    ]);

    expect(parseSamplesFromText('{"foo":1}')).toEqual([{ foo: 1 }]);

    expect(parseSamplesFromText('{"foo":1}\n{"foo":2}')).toEqual([
      { foo: 1 },
      { foo: 2 },
    ]);
  });

  it("infers runtype, jsonschema, and typescript output", () => {
    const samples = [{ foo: "bar" }, { foo: "baz", bar: 1 }];

    expect(
      inferFromSamples(samples, {
        format: "runtype",
        requiredFieldThreshold: 1,
      })
    ).toEqual(
      'R.Record({ "bar": R.Number.Or(R.Undefined), "foo": R.String })\n'
    );

    expect(
      inferFromSamples(samples, {
        format: "jsonschema",
        requiredFieldThreshold: 1,
      })
    ).toEqual(`{
  "type": "object",
  "properties": {
    "bar": {
      "type": "number"
    },
    "foo": {
      "type": "string"
    }
  },
  "additionalProperties": false,
  "required": [
    "foo"
  ]
}
`);

    expect(
      inferFromSamples(samples, {
        format: "typescript",
        requiredFieldThreshold: 1,
      })
    ).toEqual('{ "bar"?: number; "foo": string; }\n');
  });

  it("rejects diff format for inferFromSamples helper", () => {
    expect(() =>
      inferFromSamples([{ foo: "bar" }], {
        format: "diff",
      })
    ).toThrow("inferFromSamples does not support diff format");
  });
});
