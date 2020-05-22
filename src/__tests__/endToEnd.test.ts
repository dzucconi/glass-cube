import { jsonToCode } from "../jsonToCode";
import { runtypeToCode } from "../runtypeToCode";
import { mergeRuntypes } from "../mergeRuntypes";
import { codeToRuntype } from "../codeToRuntype";

describe("end to end", () => {
  const INPUT_A = { foo: "bar", bar: 1, baz: false, qux: null };
  const INPUT_B = { foo: "baz", bar: null, qux: "not", quux: { quuz: 44 } };

  const CODE_A = jsonToCode(INPUT_A);
  const CODE_B = jsonToCode(INPUT_B);

  const ExampleA = codeToRuntype(CODE_A);
  const ExampleB = codeToRuntype(CODE_B);

  it("validates", () => {
    expect(ExampleA.validate(INPUT_A).success).toBe(true);
    expect(ExampleB.validate(INPUT_B).success).toBe(true);
    expect(ExampleA.validate(INPUT_B).success).toBe(false);
    expect(ExampleB.validate(INPUT_A).success).toBe(false);
  });

  it("converts back into the same code", () => {
    expect(runtypeToCode(ExampleA)).toEqual(CODE_A);
    expect(runtypeToCode(ExampleB)).toEqual(CODE_B);
  });

  it("validates all examples once merged", () => {
    const ExampleC = mergeRuntypes(ExampleA, ExampleB);

    expect(runtypeToCode(ExampleC)).toEqual(
      "R.Record({ foo: R.String, bar: R.Null.Or(R.Number), baz: R.Boolean.Or(R.Undefined), qux: R.String.Or(R.Null), quux: R.Record({ quuz: R.Number }).Or(R.Undefined) })"
    );

    expect(ExampleC.validate(INPUT_A).success).toBe(true);
    expect(ExampleC.validate(INPUT_B).success).toBe(true);
  });
});
