import type { KeyboardEvent as ReactKeyboardEvent } from "react";

/**
 * Roving focus for role="menu" containers: ArrowUp/ArrowDown/Home/End move
 * focus between the menu's items. Attach to the menu container's onKeyDown.
 */
export function onMenuRovingKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
  const { key } = event;
  if (
    key !== "ArrowDown" &&
    key !== "ArrowUp" &&
    key !== "Home" &&
    key !== "End"
  ) {
    return;
  }
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      '[role^="menuitem"]:not([disabled])',
    ),
  );
  if (items.length === 0) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  let next: number;
  if (key === "Home") next = 0;
  else if (key === "End") next = items.length - 1;
  else if (key === "ArrowDown")
    next = index < 0 ? 0 : (index + 1) % items.length;
  else next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length;
  event.preventDefault();
  items[next].focus();
}
