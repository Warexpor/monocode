type Props = {
  suggestions: string[];
  disabled?: boolean;
  onSelect: (suggestion: string) => void;
};

export function FollowUpChips({ suggestions, disabled, onSelect }: Props) {
  if (suggestions.length === 0) return null;
  return (
    <div
      aria-label="Suggested follow-ups"
      className="flex flex-wrap gap-1.5 px-0.5 pb-2"
    >
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(suggestion)}
          className="max-w-full truncate rounded-md border border-content/12 bg-content/[0.04] px-2.5 py-1 font-sans text-[12px] text-content/75 transition hover:border-content/22 hover:bg-content/[0.07] hover:text-content disabled:opacity-40"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
