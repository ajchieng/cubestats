export function RecentSearches({
  recent,
  onPick,
}: {
  recent: string[];
  onPick: (wcaId: string) => void;
}) {
  if (recent.length === 0) {
    return null;
  }

  return (
    <div className="recent-row" aria-label="Recent searches">
      <span className="recent-label">Recent</span>
      {recent.map((wcaId) => (
        <button
          type="button"
          className="recent-chip"
          key={wcaId}
          onClick={() => onPick(wcaId)}
        >
          {wcaId}
        </button>
      ))}
    </div>
  );
}
