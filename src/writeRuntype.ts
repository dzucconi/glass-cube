import fs from "fs/promises";
import path from "path";
import { format } from "prettier";
import { jsonToCode } from "./jsonToCode";
import { runtypeToCode } from "./runtypeToCode";

export const HEADER = `import * as R from "runtypes";`;

export const writeRuntype = ({
  object,
  name,
  path: outputPath = "./__generated__",
}: {
  object: any;
  name: string;
  path?: string;
}) => {
  const filePath = path.join(outputPath, `${name}.ts`);
  const fileSource = format(
    [
      HEADER,
      `export const ${name} = ${
        object?.tag === "record" ? runtypeToCode(object) : jsonToCode(object)
      }`,
      `export type ${name} = R.Static<typeof ${name}>`,
    ].join("\n\n"),
    { parser: "babel" },
  );

  return fs.mkdir(outputPath, { recursive: true }).then(() => {
    return fs.writeFile(filePath, fileSource).then(() => {
      console.log(`Wrote: ${filePath}`);
      return filePath;
    });
  });
};
