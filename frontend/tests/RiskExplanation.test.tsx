import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RiskExplanation } from "@/components/ui/RiskExplanation";

const factors = {
  acwr: { label: "ACWR", value: 1.6, contribution: 45, description: "Sobrecarga" },
  injury_history_12m: { label: "Lesiones 12m", value: 2, contribution: 16, description: "Recidiva" },
  age: { label: "Edad", value: 32, contribution: 10, description: "Edad alta" },
};

describe("RiskExplanation", () => {
  it("displays the total score and level", () => {
    render(<RiskExplanation score={71} level="high" factors={factors} />);
    expect(screen.getByText("71")).toBeInTheDocument();
    expect(screen.getByText("Alto")).toBeInTheDocument();
  });

  it("lists every factor with its contribution", () => {
    render(<RiskExplanation score={71} level="high" factors={factors} />);
    expect(screen.getByText("ACWR")).toBeInTheDocument();
    expect(screen.getByText("Lesiones 12m")).toBeInTheDocument();
    expect(screen.getByText("Edad")).toBeInTheDocument();
    expect(screen.getByText("+45")).toBeInTheDocument();
    expect(screen.getByText("+16")).toBeInTheDocument();
    expect(screen.getByText("+10")).toBeInTheDocument();
  });

  it("sorts factors by contribution descending", () => {
    render(<RiskExplanation score={71} level="high" factors={factors} />);
    const acwr = screen.getByText("ACWR");
    const lesiones = screen.getByText("Lesiones 12m");
    const edad = screen.getByText("Edad");
    // ACWR (+45) > Lesiones (+16) > Edad (+10): ACWR appears before the others in the DOM.
    expect(acwr.compareDocumentPosition(lesiones) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lesiones.compareDocumentPosition(edad) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
