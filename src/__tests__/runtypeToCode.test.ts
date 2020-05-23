import * as R from "runtypes";
import { runtypeToCode } from "../runtypeToCode";

describe("runtypeToCode", () => {
  it("works on primitives", () => {
    expect(runtypeToCode(R.String)).toEqual("R.String");
    expect(runtypeToCode(R.Null)).toEqual("R.Null");
    expect(runtypeToCode(R.Undefined)).toEqual("R.Undefined");
  });

  it("works on unions", () => {
    expect(runtypeToCode(R.Union(R.String, R.Null))).toEqual(
      "R.String.Or(R.Null)"
    );

    expect(
      runtypeToCode(R.Union(R.Null, R.Number, R.String, R.Undefined))
    ).toEqual("R.Null.Or(R.Number).Or(R.String).Or(R.Undefined)");

    expect(
      runtypeToCode(
        R.String.Or(R.Null).Or(R.Undefined).Or(R.Number).Or(R.Boolean)
      )
    ).toEqual("R.String.Or(R.Null).Or(R.Undefined).Or(R.Number).Or(R.Boolean)");

    expect(runtypeToCode(R.Union(R.String))).toEqual("R.String");
  });

  it("works on records", () => {
    expect(
      runtypeToCode(
        R.Record({
          foo: R.Record({
            bar: R.String.Or(R.Undefined),
          }).Or(R.Null),
        })
      )
    ).toEqual(
      'R.Record({ "foo": R.Record({ "bar": R.String.Or(R.Undefined) }).Or(R.Null) })'
    );
  });
});
