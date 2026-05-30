import { describe, expect, it } from "vitest";

import { resolveRendererAssetUrl } from "./appAsset";

describe("resolveRendererAssetUrl", () => {
  it("resolves renderer assets relative to the packaged Electron index page", () => {
    expect(
      resolveRendererAssetUrl(
        "/romantsy.png",
        "file:///Applications/Romantsy-Note.app/Contents/Resources/app.asar/out/renderer/index.html",
      ),
    ).toBe(
      "file:///Applications/Romantsy-Note.app/Contents/Resources/app.asar/out/renderer/romantsy.png",
    );
  });

  it("keeps dev-server asset urls rooted at the current origin", () => {
    expect(resolveRendererAssetUrl("/romantsy.png", "http://localhost:5174/")).toBe(
      "http://localhost:5174/romantsy.png",
    );
  });
});
