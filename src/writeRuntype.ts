import fs from "fs";
import { format } from "prettier/standalone";
import { jsonToCode } from "./jsonToCode";
import { runtypeToCode } from "./runtypeToCode";

export const HEADER = `import * as R from "runtypes";`;

export const writeRuntype = ({
  object,
  name,
  path = "./__generated__",
}: {
  object: any;
  name: string;
  path: string;
}) => {
  const filePath = `${path}/${name}.ts`;
  const fileSource = format(
    [
      HEADER,
      `export const ${name} = ${
        object?.tag === "record" ? runtypeToCode(object) : jsonToCode(object)
      }`,
      `export type ${name} = R.Static<typeof ${name}>`,
    ].join("\n\n"),
    { parser: "babel" }
  );

  fs.writeFile(filePath, fileSource, (err) => {
    console.log(`Wrote: ${filePath}`);
    if (err) console.error(err);
  });
};
