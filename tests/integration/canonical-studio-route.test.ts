import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("canonical Studio routing", () => {
  it("routes the product root to one Studio and retains the legacy control room in diagnostics", () => {
    const root = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    const legacy = readFileSync(
      resolve(process.cwd(), "src/app/diagnostics/control-room/page.tsx"),
      "utf8",
    );

    expect(root).toContain('redirect("/studio")');
    expect(root).not.toContain("ControlRoom");
    expect(legacy).toContain("<ControlRoom />");
  });
});
