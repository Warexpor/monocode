/** Pull a local path or http(s) URL for generated media from tool text. */
export function mediaUrlFromToolText(text: string | undefined): string | null {
  if (!text?.trim()) return null;
  const match =
    /!\[[^\]]*]\((?<md>[^)\s]+)\)|(?<url>https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|gif|webp|mp4|webm)(?:\?[^\s"'<>]*)?)|(?<path>(?:[A-Za-z]:\\|\/|\.\/|\.\.\/)[^\s"'<>]+\.(?:png|jpe?g|gif|webp|mp4|webm))/i.exec(
      text,
    );
  const value =
    match?.groups?.md ?? match?.groups?.url ?? match?.groups?.path ?? null;
  return value?.trim() || null;
}

export function isMediaToolTitle(title: string | undefined): boolean {
  if (!title) return false;
  return /generat(?:e|ing)\s+(?:an?\s+)?(?:image|video)|edit(?:ing)?\s+(?:an?\s+)?image/i.test(
    title,
  );
}
