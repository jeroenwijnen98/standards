// What Node's type stripping cannot run, each caught by the base tsconfig.
export enum Direction {
  Up,
}
import { Fs } from "./types.ts";
export const read = (fs: Fs) => fs;
