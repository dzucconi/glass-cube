import { mergeRuntypes } from "./mergeRuntypes";
import { RecordElement } from "./runtypeToCode";

type Runtype = RecordElement;

export const reduceRuntypes = (
  runtypes: Runtype[],
  initialRuntype: Runtype | null = null
) =>
  runtypes.reduce((acc: Runtype | null, nextRuntype) => {
    if (acc === undefined || acc === null) return nextRuntype;
    return mergeRuntypes(acc, nextRuntype);
  }, initialRuntype);
