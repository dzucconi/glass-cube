# glass-cube

Generate [Runtypes](https://github.com/pelotom/runtypes) from JSON responses, merge Runtypes, and generate code from Runtypes.

## JSON => Runtype

```ts
import { jsonToRuntype } from "glass-cube";

const responseA = {
  foo: "bar",
  bar: 1,
  baz: null,
  qux: { foo: [1, 2, 3, "four"], nested: true },
};

const RuntypeA = jsonToRuntype(responseA);

RuntypeA.check(responseA); // ✅ => responseA
RuntypeA.check({ foo: "bar" }); // ❌ => Uncaught ValidationError: Expected number, but was undefined
```

```ts
import { runtypeToCode } from "glass-cube";

runtypeToCode(RuntypeA); // => 'R.Record({ "foo": R.String, "bar": R.Number, "baz": R.Null, "qux": R.Record({ "foo": R.Array(R.Number.Or(R.String)), "nested": R.Boolean }) })'
```

```ts
import { mergeRuntypes } from "glass-cube";

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
```
