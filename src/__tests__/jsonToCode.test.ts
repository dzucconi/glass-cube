import { format } from "prettier";
import { jsonToCode } from "../jsonToCode";

describe("jsonToCode", () => {
  it("emits the correct code for simple objects", () => {
    expect(jsonToCode({ foo: "bar", bar: 1, baz: false, qux: null })).toMatch(
      'R.Record({ "foo": R.String, "bar": R.Number, "baz": R.Boolean, "qux": R.Null })'
    );
  });

  it("emits the correct code for complex objects", () => {
    expect(
      jsonToCode({
        foo: {
          bar: {
            baz: {
              qux: [1, 2, 3, 4],
            },
          },
          baz: ["one", 2, false],
        },
      })
    ).toMatch(
      'R.Record({ "foo": R.Record({ "bar": R.Record({ "baz": R.Record({ "qux": R.Array(R.Number) }) }), "baz": R.Array(R.String.Or(R.Number).Or(R.Boolean)) }) })'
    );
  });

  it("supports all keys", () => {
    expect(jsonToCode({ foo: true, "bar?": true })).toEqual(
      'R.Record({ "foo": R.Boolean, "bar?": R.Boolean })'
    );
  });
});
