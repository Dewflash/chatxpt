import { describe, expect, it } from "vitest";

import { studioSurfaceForPathname } from "./StudioApplicationShell";

describe("studioSurfaceForPathname", () => {
  it("maps every Studio product route into one persistent authorised client", () => {
    expect(studioSurfaceForPathname("/studio")).toBe("studio-home");
    expect(studioSurfaceForPathname("/studio/gameplay")).toBe("studio-gameplay");
    expect(studioSurfaceForPathname("/studio/live-analytics")).toBe("studio-live-analytics");
    expect(studioSurfaceForPathname("/studio/live-quests")).toBe("studio-live-quests");
    expect(studioSurfaceForPathname("/studio/profile")).toBe("studio-profile");
    expect(studioSurfaceForPathname("/studio/stream-settings")).toBe("studio-stream-settings");
    expect(studioSurfaceForPathname("/studio/test-lab")).toBe("studio-test-lab");
  });

  it("keeps the legacy capture URL on the same Gameplay surface", () => {
    expect(studioSurfaceForPathname("/studio/gameplay/capture")).toBe("studio-gameplay");
  });
});
