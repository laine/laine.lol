import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GitHubLink, GITHUB_URL } from "../GitHubLink";

describe("GitHubLink", () => {
  it("points at the canonical repo URL", () => {
    expect(GITHUB_URL).toBe("https://github.com/EternityX/rustybin/");
  });

  it("links to the repo and opens safely in a new tab", () => {
    const { getByRole } = render(<GitHubLink />);
    const link = getByRole("link", { name: /github/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(GITHUB_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("shows a text label only when asked", () => {
    const { queryByText, rerender } = render(<GitHubLink />);
    expect(queryByText(/github/i)).toBeNull();
    rerender(<GitHubLink showLabel />);
    expect(queryByText(/github/i)).not.toBeNull();
  });
});
