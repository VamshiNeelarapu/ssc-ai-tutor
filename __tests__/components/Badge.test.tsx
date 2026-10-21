import { render, screen } from "@testing-library/react";
import { Badge, RevisionBadge } from "@/components/ui/Badge";

describe("Badge component", () => {
  it("renders children text", () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText("Test Badge")).toBeInTheDocument();
  });

  it("applies default variant styles", () => {
    const { container } = render(<Badge>Default</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-gray-100");
    expect(badge.className).toContain("text-gray-700");
  });

  it("applies custom className", () => {
    const { container } = render(
      <Badge className="custom-class">Styled</Badge>
    );
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("custom-class");
  });
});

describe("RevisionBadge component", () => {
  it("renders 'Not Started' for not_started status", () => {
    render(<RevisionBadge status="not_started" />);
    expect(screen.getByText("Not Started")).toBeInTheDocument();
  });

  it("renders 'Learning' for learning status", () => {
    render(<RevisionBadge status="learning" />);
    expect(screen.getByText("Learning")).toBeInTheDocument();
  });

  it("renders 'Needs Revision' for needs_revision status", () => {
    render(<RevisionBadge status="needs_revision" />);
    expect(screen.getByText("Needs Revision")).toBeInTheDocument();
  });

  it("renders 'Revised' for revised status", () => {
    render(<RevisionBadge status="revised" />);
    expect(screen.getByText("Revised")).toBeInTheDocument();
  });

  it("applies correct color for learning status", () => {
    const { container } = render(<RevisionBadge status="learning" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-blue-100");
    expect(badge.className).toContain("text-blue-700");
  });

  it("applies correct color for needs_revision status", () => {
    const { container } = render(<RevisionBadge status="needs_revision" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-amber-100");
    expect(badge.className).toContain("text-amber-700");
  });

  it("applies correct color for revised status", () => {
    const { container } = render(<RevisionBadge status="revised" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-green-100");
    expect(badge.className).toContain("text-green-700");
  });
});
