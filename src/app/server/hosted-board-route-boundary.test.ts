import { describe, expect, it } from "vitest";

import { assertSecureHostedBoardRequest } from "../api/hosted-board/response";

describe("hosted Quest Board route boundary", () => {
  it("requires HTTPS outside local development", () => {
    expect(() => assertSecureHostedBoardRequest(
      new Request("http://localhost:3000/api/hosted-board/viewer"),
    )).not.toThrow();
    expect(() => assertSecureHostedBoardRequest(
      new Request("https://chatxpt.example/api/hosted-board/viewer"),
    )).not.toThrow();
    expect(() => assertSecureHostedBoardRequest(
      new Request("http://chatxpt.example/api/hosted-board/viewer"),
    )).toThrow("HTTPS");
  });
});
