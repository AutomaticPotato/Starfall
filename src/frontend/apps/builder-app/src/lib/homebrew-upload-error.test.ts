import { describe, expect, it } from "vitest";
import { ApiError } from "@starlights/api-client";
import { homebrewUploadError } from "./homebrew-upload-error";

describe("homebrew upload feedback", () => {
  it("shows validation instructions without the HTTP/JSON wrapper", () => {
    const body = JSON.stringify({ message: "One or more errors occurred", errors: { content: ["Each append needs an id."] } });
    expect(homebrewUploadError(new ApiError(400, "Bad Request", body))).toBe("Each append needs an id.");
  });
  it("supports problem-details validation errors", () => {
    expect(homebrewUploadError(new ApiError(400, "Bad Request", JSON.stringify({ errors: [{ name: "Content", reason: "Use one elements root." }] })))).toBe("Use one elements root.");
  });
  it("explains permissions and handles non-JSON failures", () => {
    expect(homebrewUploadError(new ApiError(403, "Forbidden", ""))).toContain("Unlock admin");
    expect(homebrewUploadError(new ApiError(502, "Bad Gateway", "<html>gateway</html>"))).toContain("server is available");
    expect(homebrewUploadError(new Error("Failed to read file"))).toBe("Failed to read file");
  });
});
