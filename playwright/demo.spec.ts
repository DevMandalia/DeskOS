import { expect, test } from "@playwright/test";

test("demo home shows fake Acme sample data", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByText("Demo — fake Acme sample data")).toBeVisible();
  await expect(page.getByText("Example: renew domain?")).toBeVisible();
  await expect(page.getByText("Devaang")).toHaveCount(0);
});
