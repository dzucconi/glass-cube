import { jsonToCode } from "./jsonToCode";

export const jsonToRuntype = (object: any) => {
  const code = jsonToCode(object);
  return eval(['const R = require("runtypes");', code].join("\n"));
};
