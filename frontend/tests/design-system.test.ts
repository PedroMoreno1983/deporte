import { describe, it, expect } from "vitest";
import {
  getStatusConfig, getRiskConfig, getPositionConfig, getRoleConfig,
  formatAge, formatDistance,
} from "@/lib/design-system";

describe("design-system helpers", () => {
  it("maps known statuses to DS colors", () => {
    expect(getStatusConfig("available").color).toBe("#00ff87");
    expect(getStatusConfig("injured").color).toBe("#ff3b30");
    expect(getStatusConfig(undefined).label).toBe("Inactivo");
  });

  it("maps risk levels", () => {
    expect(getRiskConfig("low").color).toBe("#00ff87");
    expect(getRiskConfig("critical").color).toBe("#ff3b30");
    expect(getRiskConfig(null).label).toBe("Bajo");
  });

  it("maps positions and groups by zone color", () => {
    expect(getPositionConfig("goalkeeper").color).toBe("#f59e0b");
    expect(getPositionConfig("center_back").color).toBe("#0ea5e9");
    expect(getPositionConfig("central_mid").color).toBe("#00ff87");
    expect(getPositionConfig("center_forward").color).toBe("#ff3b30");
  });

  it("maps role keys", () => {
    expect(getRoleConfig("admin").color).toBe("#a855f7");
    expect(getRoleConfig("coach").color).toBe("#00ff87");
  });

  it("formats distance in m / km", () => {
    expect(formatDistance(450)).toBe("450 m");
    expect(formatDistance(2500)).toBe("2.50 km");
    expect(formatDistance(null)).toBe("—");
  });

  it("computes age from a birth date", () => {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 20);
    expect(formatAge(tenYearsAgo.toISOString().slice(0, 10))).toBe(20);
  });
});
