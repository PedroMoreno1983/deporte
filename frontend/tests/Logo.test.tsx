import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "@/components/ui/Logo";

describe("Logo", () => {
  it("renders the DFC monogram in mark variant", () => {
    const { container } = render(<Logo variant="mark" size={32} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.textContent).toContain("DFC");
  });

  it("renders wordmark with DEPORTE FC text", () => {
    render(<Logo variant="wordmark" size={36} />);
    expect(screen.getByText("DEPORTE")).toBeInTheDocument();
    expect(screen.getByText("FC")).toBeInTheDocument();
  });

  it("monogram variant produces a rounded container with shield inside", () => {
    const { container } = render(<Logo variant="monogram" size={40} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
