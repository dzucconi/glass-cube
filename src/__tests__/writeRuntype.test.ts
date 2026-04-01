import fs from "fs/promises";
import os from "os";
import path from "path";
import { writeRuntype } from "../writeRuntype";

describe("writeRuntype", () => {
  it("writes a runtype file and creates output directories", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "glass-cube-"));
    const outputPath = path.join(tempRoot, "nested", "generated");

    const filePath = await writeRuntype({
      object: { foo: "bar" },
      name: "Example",
      path: outputPath,
    });

    const fileSource = await fs.readFile(filePath, "utf8");

    expect(filePath).toEqual(path.join(outputPath, "Example.ts"));
    expect(fileSource).toContain(
      "export const Example = R.Record({ foo: R.String });"
    );
    expect(fileSource).toContain(
      "export type Example = R.Static<typeof Example>;"
    );
  });
});
