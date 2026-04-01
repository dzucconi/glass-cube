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

## Streaming Aggregation

For large response sets, use the streaming aggregator:

```ts
import { createAggregator } from "glass-cube";

const aggregator = createAggregator({
  requiredFieldThreshold: 0.95,
  nullHandling: "missing", // "preserve" | "missing"
});

for (const response of responses) {
  aggregator.add(response);
}

const result = aggregator.finalize();

if (result) {
  console.log(result.count); // sample count
  console.log(result.code); // runtype code
}
```

## Additional Emitters

The schema IR can emit JSON Schema and TypeScript:

```ts
import {
  createAggregator,
  schemaNodeToJSONSchema,
  schemaNodeToTypeScript,
} from "glass-cube";

const result = createAggregator().finalize();

if (result) {
  const jsonSchema = schemaNodeToJSONSchema(result.schema);
  const typeSource = schemaNodeToTypeScript(result.schema);
}
```

## CLI

Infer from JSON, JSON array, JSONL, or NDJSON files:

```sh
glass-cube --input ./responses.ndjson --format runtype
glass-cube --input ./responses.ndjson --format jsonschema --out ./schema.json
glass-cube --input ./responses.ndjson --format typescript
```

Compare schema drift between two datasets:

```sh
glass-cube \
  --input ./responses-new.ndjson \
  --compare ./responses-baseline.ndjson \
  --format diff
```
