import * as R from "runtypes";
import { mergeRuntypes } from "./mergeRuntypes";

type Runtype = R.Record<Record<string, any>, false>;

export const reduceRuntypes = (runtypes: Runtype[]) =>
  runtypes.reduce((acc: null | Runtype, nextRuntype) => {
    if (acc === undefined || acc === null) return nextRuntype;
    return mergeRuntypes(acc, nextRuntype);
  }, null);
