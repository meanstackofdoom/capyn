import { randomUUID } from "node:crypto";

export type IdPrefix =
  | "org"
  | "usr"
  | "agt"
  | "key"
  | "man"
  | "pol"
  | "auth"
  | "apr"
  | "exe"
  | "evt"
  | "sub"
  | "use"
  | "bwh";

export function createId(prefix: IdPrefix): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}
