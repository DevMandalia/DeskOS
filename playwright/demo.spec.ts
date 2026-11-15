import { expect, test } from "@playwright/test";

test("demo home shows fake Acme sample data", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok()).toBeTruthy();
  await expect(page.getByText("What needs you.")).toBeVisible();
  await expect(page.getByText("Demo. Sample data, nothing sent.")).toBeVisible();
  await expect(page.getByText("Example: renew domain?")).toBeVisible();
  await expect(page.getByText("Devaang")).toHaveCount(0);
});

test("demo chat panel uses the empty card, not a raw line", async ({ page }) => {
  await page.goto("/");
  const chatOff = page.locator("#desk-chat").getByRole("note");
  await expect(chatOff.getByText("Chat is off")).toBeVisible();
  await expect(chatOff.getByText("CHAT_COMPLETIONS_URL")).toBeVisible();
  await expect(chatOff.getByRole("link", { name: "README" })).toHaveAttribute(
    "href",
    "https://github.com/DevMandalia/DeskOS#optional-chat",
  );
  await expect(page.getByText("Chat is off in the demo.")).toHaveCount(0);
  await expect(page.getByPlaceholder("Ask me anything about your desk.")).toHaveCount(0);
});

test("board overflow is a popover that does not stretch the card", async ({ page }) => {
  await page.goto("/board");
  const card = page.locator(".task").first();
  await expect(card).toBeVisible();
  const before = await card.boundingBox();
  await card.hover();
  await card.getByRole("button", { name: /More for/ }).click();
  const menu = page.locator(".task-pop");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Edit" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Move to/ })).toBeVisible();
  await expect(menu.locator("select")).toHaveCount(0);
  const after = await card.boundingBox();
  expect(after?.height).toBe(before?.height);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});
