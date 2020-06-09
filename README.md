# glass-cube

Generate [Runtypes](https://github.com/pelotom/runtypes) from JSON responses, merge Runtypes, and generate code from Runtypes. Use it to generate a comprehensive Runtype for a given API endpoint by reducing Runtypes from disparate API responses.

## Getting Started

```sh
yarn add glass-cube --dev
```

-----

```ts
import { jsonToRuntype, runtypeToCode, mergeRuntypes, writeRuntype } from "glass-cube";

const responseA = {
  foo: "bar",
  bar: 1,
  baz: null,
  qux: { foo: [1, 2, 3, "four"], nested: true },
};

const RuntypeA = jsonToRuntype(responseA);

RuntypeA.check(responseA); // ✅ => responseA
RuntypeA.check({ foo: "bar" }); // ❌ => Uncaught ValidationError: Expected number, but was undefined

runtypeToCode(RuntypeA); // => 'R.Record({ "foo": R.String, "bar": R.Number, "baz": R.Null, "qux": R.Record({ "foo": R.Array(R.Number.Or(R.String)), "nested": R.Boolean }) })'

const responseB = {
  foo: "baz",
  bar: 2,
  baz: "foo",
  qux: null,
};

const RuntypeB = jsonToRuntype(responseB);
const RuntypeC = mergeRuntypes(RuntypeA, RuntypeB);

RuntypeB.check(responseB); // ✅
RuntypeB.check(responseA); // ❌

RuntypeC.check(responseA); // ✅
RuntypeC.check(responseB); // ✅

runtypeToCode(RuntypeC); // => 'R.Record({ "foo": R.String, "bar": R.Number, "baz": R.String.Or(R.Null), "qux": R.Null.Or(R.Record({ "foo": R.Array(R.Number.Or(R.String)), "nested": R.Boolean })) })'

writeRuntype({ object: RuntypeC, name: 'Example', path: '.' }) // => Wrote: ./Example.ts

/**
 * Example.ts:
 *
 * import * as R from "runtypes";
 * 
 * export const Example = R.Record({
 *   foo: R.String,
 *   bar: R.Number,
 *   baz: R.String.Or(R.Null),
 *   qux: R.Null.Or(
 *     R.Record({ foo: R.Array(R.Number.Or(R.String)), nested: R.Boolean })
 *   ),
 * });
 * 
 * export type Example = R.Static<typeof Example>;
 */
```
