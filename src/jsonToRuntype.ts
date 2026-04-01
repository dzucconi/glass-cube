import { codeToRuntype } from "./codeToRuntype";
import { jsonToCode } from "./jsonToCode";

export const jsonToRuntype = (object: Record<string, unknown>) => {
  const code = jsonToCode(object);
  return codeToRuntype(code);
};
