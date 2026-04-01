import { codeToRuntype } from "./codeToRuntype";
import { jsonToCode } from "./jsonToCode";

export const jsonToRuntype = (object: any) => {
  const code = jsonToCode(object);
  return codeToRuntype(code);
};
