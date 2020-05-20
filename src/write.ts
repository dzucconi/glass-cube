import fs from "fs";
import { format } from "prettier";
import { jsonToCode } from "./jsonToCode";
import { runtypeToCode } from "./runtypeToCode";

export const HEADER = `import * as R from "runtypes";`;

export const write = ({ object, name }: { object: any; name: string }) => {
  const filePath = `./__generated__/${name}.ts`;
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
