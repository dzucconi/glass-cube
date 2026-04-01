import { codeToRuntype } from "../codeToRuntype";

describe("codeToRuntype", () => {
  it("parses supported runtype code", () => {
    const Example = codeToRuntype(
      'R.Record({ "foo": R.String.Or(R.Null), "bar": R.Array(R.Number.Or(R.Boolean)) })'
    );

    expect(Example.validate({ foo: "x", bar: [1, true, 2] }).success).toBe(
      true
    );
    expect(Example.validate({ foo: null, bar: [1] }).success).toBe(true);
    expect(Example.validate({ foo: false, bar: [1] }).success).toBe(false);
  });

  it("rejects arbitrary code execution attempts", () => {
    expect(() => codeToRuntype('(() => process.exit(1))()')).toThrow();
  });
});
