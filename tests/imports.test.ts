import { describe, expect, it } from "vitest";
import {
  extractSpecifiers,
  parseImports,
  stripComments,
} from "../src/core/imports.js";

describe("imports parser", () => {
  it("strips comments before matching", () => {
    const src = `
      // import './nope.js'
      /* import './block.js' */
      import './real.js';
    `;
    expect(stripComments(src)).not.toContain("./nope");
    const specs = extractSpecifiers(src);
    expect(specs.map((s) => s.specifier)).toEqual(["./real.js"]);
  });

  it("extracts import, require, export-from, and dynamic import", () => {
    const src = `
      import x from './a.js';
      import type { T } from './t.js';
      export { y } from './b.js';
      const z = require('./c.js');
      const w = await import('./d.js');
      import 'side-effect-pkg';
    `;
    const specs = extractSpecifiers(src);
    const set = new Set(specs.map((s) => s.specifier));
    expect(set.has("./a.js")).toBe(true);
    expect(set.has("./t.js")).toBe(true);
    expect(set.has("./b.js")).toBe(true);
    expect(set.has("./c.js")).toBe(true);
    expect(set.has("./d.js")).toBe(true);
    expect(set.has("side-effect-pkg")).toBe(false);
  });

  it("resolves relative imports against known files", () => {
    const known = new Set(["src/utils/math.ts", "src/core.ts"]);
    const { edges, unresolved } = parseImports(
      "src/core.ts",
      `import { add } from './utils/math.js';\nimport './missing.js';`,
      known,
    );
    expect(edges).toHaveLength(1);
    expect(edges[0]!.to).toBe("src/utils/math.ts");
    expect(unresolved).toContain("./missing.js");
  });
});
