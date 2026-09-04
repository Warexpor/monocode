/** In-transcript find: mark text matches under `[data-block-id]` nodes. */

const MARK_ATTR = "data-transcript-find";

export function clearTranscriptFindMarks(root: HTMLElement): void {
  const marks = root.querySelectorAll(`mark[${MARK_ATTR}]`);
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }
}

export function applyTranscriptFindMarks(
  root: HTMLElement,
  query: string,
): HTMLElement[] {
  clearTranscriptFindMarks(root);
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const marks: HTMLElement[] = [];
  const targets = root.querySelectorAll<HTMLElement>("[data-block-id]");
  for (const target of targets) {
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let node = walker.nextNode();
    while (node) {
      nodes.push(node as Text);
      node = walker.nextNode();
    }
    for (const textNode of nodes) {
      const value = textNode.nodeValue;
      if (!value) continue;
      const lower = value.toLowerCase();
      let from = 0;
      let hit = lower.indexOf(needle, from);
      if (hit < 0) continue;

      const parts: Array<string | HTMLElement> = [];
      while (hit >= 0) {
        if (hit > from) parts.push(value.slice(from, hit));
        const mark = document.createElement("mark");
        mark.setAttribute(MARK_ATTR, "");
        mark.className =
          "transcript-find-hit rounded-[2px] bg-accent/35 text-inherit";
        mark.textContent = value.slice(hit, hit + needle.length);
        parts.push(mark);
        marks.push(mark);
        from = hit + needle.length;
        hit = lower.indexOf(needle, from);
      }
      if (from < value.length) parts.push(value.slice(from));

      const parent = textNode.parentNode;
      if (!parent) continue;
      for (const part of parts) {
        parent.insertBefore(
          typeof part === "string" ? document.createTextNode(part) : part,
          textNode,
        );
      }
      parent.removeChild(textNode);
    }
  }
  return marks;
}

export function setActiveTranscriptFindMark(
  marks: HTMLElement[],
  activeIndex: number,
): HTMLElement | null {
  let active: HTMLElement | null = null;
  marks.forEach((mark, index) => {
    const on = index === activeIndex;
    mark.classList.toggle("bg-accent/35", !on);
    mark.classList.toggle("bg-accent/55", on);
    mark.classList.toggle("ring-1", on);
    mark.classList.toggle("ring-accent", on);
    if (on) active = mark;
  });
  return active;
}
