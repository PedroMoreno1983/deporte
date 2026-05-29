import { test, expect } from "@playwright/test";

/**
 * Smoke test of the login flow.
 * Assumes the backend is seeded (run `python seed.py`) and the dev server is up.
 */

test.describe("Login", () => {
  test("renders branding and demo accounts", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("DEPORTE")).toBeVisible();
    await expect(page.getByText("FC")).toBeVisible();
    await expect(page.getByText("Bienvenido de vuelta")).toBeVisible();
    // Demo accounts grid
    await expect(page.getByRole("button", { name: /entrenador/i })).toBeVisible();
  });

  test("autofills credentials when a demo account is clicked", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /entrenador/i }).click();
    await expect(page.getByPlaceholder(/tu@deportefc/i)).toHaveValue(/.+@deporte\.fc/);
  });

  test("shows validation error on empty submit", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /ingresar/i }).click();
    await expect(page.getByText(/email/i).first()).toBeVisible();
  });
});
