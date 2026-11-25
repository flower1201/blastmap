import { rank } from "./service.js";

export function main(values: number[]): string {
  return rank(values);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(main([10, 20, 30]));
}
