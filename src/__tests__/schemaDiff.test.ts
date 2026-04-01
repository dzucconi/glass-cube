import { diffSchemas } from "../schemaDiff";
import { ObjectSchemaNode, mergeSchemaNodes, schemaFromValue } from "../schemaIR";

const asObjectSchema = (node: ReturnType<typeof schemaFromValue>) => {
  if (node.kind !== "object") {
    throw new Error("Expected object schema");
  }

  return node as ObjectSchemaNode;
};

describe("diffSchemas", () => {
  it("detects removed fields as breaking", () => {
    const previous = schemaFromValue({ foo: "bar", bar: 1 });
    const next = schemaFromValue({ foo: "bar" });

    const diff = diffSchemas(asObjectSchema(previous), asObjectSchema(next));

    expect(diff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.bar",
          kind: "field_removed",
          severity: "breaking",
        }),
      ])
    );
  });

  it("detects widened and narrowed type changes", () => {
    const stringOnly = schemaFromValue({ foo: "bar" });
    const stringOrNull = mergeSchemaNodes(
      schemaFromValue({ foo: "bar" }),
      schemaFromValue({ foo: null })
    );

    const widened = diffSchemas(
      asObjectSchema(stringOnly),
      asObjectSchema(stringOrNull)
    );
    const narrowed = diffSchemas(
      asObjectSchema(stringOrNull),
      asObjectSchema(stringOnly)
    );

    expect(widened).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.foo",
          kind: "type_widened",
          severity: "non_breaking",
        }),
      ])
    );

    expect(narrowed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.foo",
          kind: "type_narrowed",
          severity: "breaking",
        }),
      ])
    );
  });

  it("detects optional-to-required transitions", () => {
    const optional = mergeSchemaNodes(
      schemaFromValue({ foo: "bar" }),
      schemaFromValue({})
    );
    const required = schemaFromValue({ foo: "bar" });

    const diff = diffSchemas(asObjectSchema(optional), asObjectSchema(required), {
      requiredFieldThreshold: 1,
    });

    expect(diff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.foo",
          kind: "field_became_required",
          severity: "breaking",
        }),
      ])
    );
  });
});
