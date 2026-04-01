import {
  diffFromFiles,
  inferFromFile,
  inferFromSamples,
  parseCLIArgs,
  parseSamplesFromText,
} from "../cli";
import fs from "fs/promises";
import os from "os";
import path from "path";

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

  it("infers from ndjson files", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "glass-cube-cli-"));
    const filePath = path.join(dir, "responses.ndjson");

    await fs.writeFile(filePath, '{"foo":"bar"}\n{"foo":"baz","bar":1}\n');

    const output = await inferFromFile(filePath, {
      format: "runtype",
    });

    expect(output).toEqual(
      'R.Record({ "bar": R.Number.Or(R.Undefined), "foo": R.String })\n'
    );
  });

  it("diffs schemas between two files", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "glass-cube-cli-diff-"));
    const baselinePath = path.join(dir, "baseline.ndjson");
    const currentPath = path.join(dir, "current.ndjson");

    await fs.writeFile(baselinePath, '{"foo":"bar"}\n');
    await fs.writeFile(currentPath, '{"foo":"bar","bar":1}\n');

    const output = await diffFromFiles(currentPath, baselinePath, {});
    const diff = JSON.parse(output);

    expect(diff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.bar",
          kind: "field_added",
          severity: "non_breaking",
        }),
      ])
    );
  });
});
