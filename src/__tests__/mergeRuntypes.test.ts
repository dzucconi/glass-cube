import * as R from "runtypes";
import { mergeRuntypes, flatten } from "../mergeRuntypes";
import { jsonToRuntype } from "../jsonToRuntype";
import { runtypeToCode } from "../runtypeToCode";
import { reduceRuntypes } from "../reduceRuntypes";
import { FEATURES } from "../__fixtures__/fixtures";

describe("flatten", () => {
  it("flattens multiple types into a single union", () => {
    expect(
      runtypeToCode(
        flatten(
          R.String,
          R.Union(R.String, R.Null),
          R.Union(R.String, R.Number, R.Undefined),
          R.Number,
          R.Undefined,
          R.Null
        )
      )
    ).toEqual("R.String.Or(R.Null).Or(R.Number).Or(R.Undefined)");
  });
});

describe("mergeRuntypes", () => {
  it("merges runtypes without duplication", () => {
    const INPUT_A = { foo: "bar" };
    const INPUT_B = { foo: null };
    const INPUT_C = { foo: null };
    const INPUT_D = { foo: "baz" };

    const ExampleA = jsonToRuntype(INPUT_A);
    const ExampleB = jsonToRuntype(INPUT_B);
    const ExampleC = jsonToRuntype(INPUT_C);
    const ExampleD = jsonToRuntype(INPUT_D);

    const ExampleE = mergeRuntypes(ExampleA, ExampleB);
    const ExampleF = mergeRuntypes(ExampleE, ExampleC);
    const ExampleG = mergeRuntypes(ExampleF, ExampleD);
    const ExampleH = mergeRuntypes(ExampleE, ExampleF);
    const ExampleI = mergeRuntypes(ExampleH, ExampleG);
    const ExampleJ = mergeRuntypes(ExampleI, ExampleH);

    expect(runtypeToCode(ExampleJ)).toEqual(
      "R.Record({ foo: R.Null.Or(R.String) })"
    );
  });

  it("merges runtypes with nested records without duplication", () => {
    const INPUT_A = { foo: { bar: "baz" } };
    const INPUT_B = { foo: {} };
    const INPUT_C = { foo: { bar: "qux" } };
    const INPUT_D = { foo: {} };

    const ExampleA = jsonToRuntype(INPUT_A);
    const ExampleB = jsonToRuntype(INPUT_B);
    const ExampleC = jsonToRuntype(INPUT_C);
    const ExampleD = jsonToRuntype(INPUT_D);

    expect(
      runtypeToCode(
        mergeRuntypes(
          mergeRuntypes(
            mergeRuntypes(mergeRuntypes(ExampleD, ExampleC), ExampleB),
            ExampleA
          ),
          mergeRuntypes(
            mergeRuntypes(mergeRuntypes(ExampleA, ExampleB), ExampleC),
            ExampleD
          )
        )
      )
    ).toEqual("R.Record({ foo: R.Record({ bar: R.String.Or(R.Undefined) }) })");
  });

  it("handles arrays", () => {
    const ExampleA = jsonToRuntype({ foo: [] });
    const ExampleB = jsonToRuntype({ foo: ["a"] });
    const ExampleC = jsonToRuntype({ foo: null });

    expect(
      runtypeToCode(reduceRuntypes([ExampleA, ExampleB, ExampleC])!)
    ).toEqual("R.Record({ foo: R.Null.Or(R.Array(R.String)) })");
  });

  it("handles arrays of records", () => {
    const Example = reduceRuntypes([
      jsonToRuntype({ foo: [] }),
      jsonToRuntype({ foo: [{ bar: "baz", baz: true }] }),
      jsonToRuntype({ foo: [{ baz: "true" }] }),
    ])!;

    expect(runtypeToCode(Example)).toEqual(
      "R.Record({ foo: R.Array(R.Record({ baz: R.Boolean.Or(R.String), bar: R.String.Or(R.Undefined) })) })"
    );
  });

  describe("reduceRuntypes", () => {
    it("it merges real world runtypes", () => {
      const runtypes = FEATURES.map(jsonToRuntype);
      const runtype = reduceRuntypes(runtypes)!;

      expect(runtypeToCode(runtype)).toEqual(
        "R.Record({ image_url: R.String.Or(R.Null), image_versions: R.Array(R.String), image_urls: R.Record({ large_rectangle: R.String.Or(R.Undefined), square: R.String.Or(R.Undefined), wide: R.String.Or(R.Undefined), source: R.String.Or(R.Undefined) }) })"
      );
    });

    it("it merges more than 2 types", () => {
      expect(
        runtypeToCode(
          reduceRuntypes(
            [{ foo: "" }, { foo: null }, {}, { foo: 2 }].map(jsonToRuntype)
          )!
        )
      ).toEqual(
        "R.Record({ foo: R.Null.Or(R.String).Or(R.Undefined).Or(R.Number) })"
      );
    });

    it("merges with an initial starting runtype", () => {
      const initialRuntype = jsonToRuntype({ foo: null, bar: "baz" });
      const nextRuntypes = [{ baz: "qux" }, { foo: "bar", baz: "qux" }].map(
        jsonToRuntype
      );

      expect(
        runtypeToCode(reduceRuntypes(nextRuntypes, initialRuntype)!)
      ).toEqual(
        "R.Record({ foo: R.Null.Or(R.Undefined).Or(R.String), bar: R.String.Or(R.Undefined), baz: R.String.Or(R.Undefined) })"
      );
    });
  });
});
