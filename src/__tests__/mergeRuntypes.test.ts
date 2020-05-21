import { format } from "prettier";
import { mergeRuntypes } from "../mergeRuntypes";
import { jsonToRuntype } from "../jsonToRuntype";
import { runtypeToCode } from "../runtypeToCode";
import { reduceRuntypes } from "../reduceRuntypes";
import { FEATURES } from "../__fixtures__/fixtures";

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

  it("it merges real world runtypes", () => {
    const runtypes = FEATURES.map(jsonToRuntype);
    const runtype = reduceRuntypes(runtypes)!;

    expect(runtypeToCode(runtype)).toEqual(
      "R.Record({ image_url: R.String.Or(R.Null), image_versions: R.Array(R.String), image_urls: R.Record({ large_rectangle: R.String.Or(R.Undefined), square: R.String.Or(R.Undefined), wide: R.String.Or(R.Undefined), source: R.String.Or(R.Undefined) }) })"
    );
  });
});
