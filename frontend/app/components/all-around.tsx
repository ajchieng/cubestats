import type {
  AllAround,
  KinchEventScore,
  SumOfRanksGroup,
} from "../lib/types";

const EVENT_SHORT_LABELS: Record<string, string> = {
  "333": "3x3",
  "222": "2x2",
  "444": "4x4",
  "555": "5x5",
  "666": "6x6",
  "777": "7x7",
  "333bf": "3BLD",
  "333fm": "FM",
  "333oh": "OH",
  clock: "Clock",
  minx: "Mega",
  pyram: "Pyra",
  skewb: "Skewb",
  sq1: "SQ1",
  "444bf": "4BLD",
  "555bf": "5BLD",
  "333mbf": "MBLD",
};

const RADAR_SIZE = 360;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 132;
const RADAR_RINGS = [25, 50, 75, 100];

function shortLabel(eventId: string, fallback: string) {
  return EVENT_SHORT_LABELS[eventId] ?? fallback;
}

export function AllAroundPanel({ allAround }: { allAround: AllAround }) {
  const { kinch, sum_of_ranks: sor } = allAround;

  return (
    <section className="all-around-section" aria-label="All-around profile">
      <div className="chart-panel all-around-radar-card">
        <div className="panel-title-row">
          <h3>Event strength</h3>
          <span className="unit-label">% of world record</span>
        </div>
        <KinchRadar events={kinch.events} />
      </div>

      <div className="chart-panel kinch-card">
        <div className="kinch-headline">
          <p className="label">Kinch score</p>
          <p className="kinch-value">
            {kinch.overall === null ? "N/A" : kinch.overall.toFixed(2)}
          </p>
          <p className="milestone-detail">
            Mean % of the world record across {kinch.event_count} current
            events.
          </p>
        </div>

        <div className="sor-block">
          <p className="label">Sum of ranks</p>
          <SorRow label="Single" group={sor.single} />
          <SorRow label="Average" group={sor.average} />
        </div>
      </div>
    </section>
  );
}

function SorRow({ label, group }: { label: string; group: SumOfRanksGroup }) {
  const cells = [
    { key: "NR", value: group.country },
    { key: "CR", value: group.continent },
    { key: "WR", value: group.world },
  ];

  return (
    <div className="sor-row">
      <span className="sor-row-label">{label}</span>
      <div className="rank-badges">
        {cells.map((cell) => (
          <span className="rank-badge" key={cell.key}>
            <span className="rank-badge-key">{cell.key}</span>
            {cell.value === null ? "—" : cell.value.toLocaleString()}
          </span>
        ))}
      </div>
    </div>
  );
}

function KinchRadar({ events }: { events: KinchEventScore[] }) {
  if (events.length < 3) {
    return (
      <div className="radar-empty">
        <p className="empty-state">
          Needs at least 3 scored events to draw a strength radar.
        </p>
      </div>
    );
  }

  const count = events.length;
  const points = events.map((event, index) => {
    const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
    const radius = (Math.max(0, Math.min(100, event.score)) / 100) * RADAR_RADIUS;
    return {
      event,
      angle,
      x: RADAR_CENTER + radius * Math.cos(angle),
      y: RADAR_CENTER + radius * Math.sin(angle),
      axisX: RADAR_CENTER + RADAR_RADIUS * Math.cos(angle),
      axisY: RADAR_CENTER + RADAR_RADIUS * Math.sin(angle),
      labelX: RADAR_CENTER + (RADAR_RADIUS + 20) * Math.cos(angle),
      labelY: RADAR_CENTER + (RADAR_RADIUS + 20) * Math.sin(angle),
    };
  });

  const polygon = points
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");

  return (
    <svg
      aria-label="Event strength radar"
      className="radar"
      role="img"
      viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
    >
      {RADAR_RINGS.map((ring) => (
        <circle
          className="radar-ring"
          key={ring}
          cx={RADAR_CENTER}
          cy={RADAR_CENTER}
          r={(ring / 100) * RADAR_RADIUS}
        />
      ))}

      {points.map((point) => (
        <line
          className="radar-axis"
          key={`axis-${point.event.event_id}`}
          x1={RADAR_CENTER}
          y1={RADAR_CENTER}
          x2={point.axisX}
          y2={point.axisY}
        />
      ))}

      <polygon className="radar-area" points={polygon} />

      {points.map((point) => (
        <circle
          className="radar-point"
          key={`point-${point.event.event_id}`}
          cx={point.x}
          cy={point.y}
          r="4"
        >
          <title>
            {`${point.event.name}: ${point.event.score.toFixed(2)} (${point.event.basis})`}
          </title>
        </circle>
      ))}

      {points.map((point) => (
        <text
          className="radar-label"
          key={`label-${point.event.event_id}`}
          x={point.labelX}
          y={point.labelY + 4}
          textAnchor={radarAnchor(point.labelX)}
        >
          {shortLabel(point.event.event_id, point.event.name)}
        </text>
      ))}
    </svg>
  );
}

function radarAnchor(labelX: number): "start" | "middle" | "end" {
  if (labelX > RADAR_CENTER + 6) {
    return "start";
  }
  if (labelX < RADAR_CENTER - 6) {
    return "end";
  }
  return "middle";
}
