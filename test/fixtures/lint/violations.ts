// One violation per rule of the base config.
export const nested = (a: number) => (a > 1 ? (a > 2 ? 1 : 2) : 3);
export const spread = (xs: number[]) => xs.reduce((acc, x) => ({ ...acc, [x]: x }), {});
export const copied = (xs: number[]) => xs.reduce((acc, x) => acc.concat(x), [] as number[]);
export const chained = (v: number) => v as unknown as string;
export function widened() {
  const source = { id: "a" };
  const erased: unknown = source;
  return erased as { readonly id: string };
}
export function unused() {
  const never = 1;
}
