export const codeToRuntype = (code: string) => {
  return eval(['const R = require("runtypes");', code].join("\n"));
};
