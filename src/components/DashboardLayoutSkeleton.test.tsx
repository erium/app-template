import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

describe("<DashboardLayoutSkeleton />", () => {
  it("renders sidebar and main content skeleton placeholders", () => {
    const { container } = render(<DashboardLayoutSkeleton />);

    // Skeleton primitives mark themselves with data-slot="skeleton"
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');

    // Sidebar logo (2) + menu items (3) + user profile (3) + main (5) = 13
    expect(skeletons.length).toBeGreaterThanOrEqual(10);
  });

  it("is a self-contained fragment that renders without props", () => {
    const { container } = render(<DashboardLayoutSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
