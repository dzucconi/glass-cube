import fs from "fs/promises";
import path from "path";
import { format } from "prettier";
import { jsonToCode } from "./jsonToCode";
import { RecordElement, runtypeToCode } from "./runtypeToCode";

export const HEADER = `import * as R from "runtypes";`;

const isRecordRuntype = (value: unknown): value is RecordElement => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (value as { tag?: string }).tag === "record";
};

export const writeRuntype = ({
  object,
  name,
  path: outputPath = "./__generated__",
}: {
  object: unknown;
  name: string;
  path?: string;
}) => {
  const filePath = path.join(outputPath, `${name}.ts`);
  const fileSource = format(
    [
      HEADER,
      `export const ${name} = ${
        isRecordRuntype(object) ? runtypeToCode(object) : jsonToCode(object)
      }`,
      `export type ${name} = R.Static<typeof ${name}>`,
    ].join("\n\n"),
    { parser: "babel" },
  );

  return fs.mkdir(outputPath, { recursive: true }).then(async () => {
    await fs.writeFile(filePath, fileSource);
    console.log(`Wrote: ${filePath}`);
    return filePath;
  });
};
