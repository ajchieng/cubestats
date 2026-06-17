import type { RankPositions } from "../lib/types";

export function Metric({
  label,
  value,
  rank,
}: {
  label: string;
  value: string | number | null | undefined;
  rank?: RankPositions | null;
}) {
  return (
    <div className="metric">
      <p className="label">{label}</p>
      <p className="metric-value">{value ?? "N/A"}</p>
      <RankBadges rank={rank} />
    </div>
  );
}

function RankBadges({ rank }: { rank?: RankPositions | null }) {
  if (!rank) {
    return null;
  }

  const badges = [
    { key: "NR", value: rank.country },
    { key: "CR", value: rank.continent },
    { key: "WR", value: rank.world },
  ].filter(
    (badge): badge is { key: string; value: number } =>
      typeof badge.value === "number" && badge.value > 0
  );

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="rank-badges">
      {badges.map((badge) => (
        <span className="rank-badge" key={badge.key}>
          <span className="rank-badge-key">{badge.key}</span>
          {badge.value.toLocaleString()}
        </span>
      ))}
    </div>
  );
}
