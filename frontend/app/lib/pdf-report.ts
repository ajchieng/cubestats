import { jsPDF } from "jspdf";
import type {
  CompetitorProgression,
  EventProgression,
  EventStats,
  ProgressionPoint,
  RankPositions,
  ResultRow,
} from "./types";
import { formatDnfRate } from "./result-utils";

type CompetitorReportArgs = {
  profile: CompetitorProgression;
  event: EventProgression;
  averagePoints: ProgressionPoint[];
};

type ComparisonReportArgs = {
  primary: CompetitorProgression;
  secondary: CompetitorProgression;
  eventId: string;
};

type PdfDoc = InstanceType<typeof jsPDF>;

type ChartSeries = {
  name: string;
  color: RgbColor;
  points: ProgressionPoint[];
};

type NormalizedChartSeries = Omit<ChartSeries, "points"> & {
  points: (ProgressionPoint & { value: number })[];
};

type RgbColor = [number, number, number];

const PAGE = {
  width: 297,
  height: 210,
  margin: 12,
  footerY: 202,
} as const;

const COLORS = {
  ink: [22, 28, 36] as RgbColor,
  muted: [92, 101, 112] as RgbColor,
  faint: [226, 231, 237] as RgbColor,
  panel: [247, 249, 252] as RgbColor,
  panelDark: [234, 239, 246] as RgbColor,
  primary: [24, 86, 168] as RgbColor,
  secondary: [219, 120, 40] as RgbColor,
  green: [20, 132, 92] as RgbColor,
  white: [255, 255, 255] as RgbColor,
} as const;

const FOOTER_TEXT =
  "Unofficial WCA analytics. Data from public WCA result mirrors.";

export function exportCompetitorReport({
  profile,
  event,
  averagePoints,
}: CompetitorReportArgs): void {
  const doc = createDoc();
  drawHeader(doc, {
    title: "Cubestats",
    subtitle: `${profile.name} | ${profile.wca_id}`,
    meta: `${event.name} | Exported ${formatExportDate(new Date())}`,
  });

  drawStatGrid(
    doc,
    [
      { label: "Current PB", value: valueOrNa(event.stats.current_pb) },
      {
        label: `Best ${event.average_label}`,
        value: valueOrNa(event.stats.best_average),
      },
      { label: "World rank", value: rankValue(event.stats.single_rank?.world) },
      {
        label: "Continent rank",
        value: rankValue(event.stats.single_rank?.continent),
      },
      {
        label: "Country rank",
        value: rankValue(event.stats.single_rank?.country),
      },
      { label: "Average solve", value: valueOrNa(event.stats.average_solve) },
      { label: "Median solve", value: valueOrNa(event.stats.median_solve) },
      { label: "Consistency", value: valueOrNa(event.stats.solve_std_dev) },
      { label: "DNF rate", value: formatDnfRate(event.stats) },
      {
        label: "Competitions",
        value: event.stats.competition_count.toLocaleString(),
      },
      {
        label: "Official solves",
        value: event.stats.solve_count.toLocaleString(),
      },
    ],
    12,
    35,
    273,
    38,
    11
  );

  drawLineChart(doc, {
    title: "Single PB progression",
    x: 12,
    y: 82,
    width: 132,
    height: 52,
    unit: event.unit,
    series: [
      {
        name: "Single PB",
        color: COLORS.primary,
        points: event.pb_progression,
      },
    ],
    emptyMessage: "No dated PB progression points.",
  });

  drawLineChart(doc, {
    title: `${event.average_label} history`,
    x: 153,
    y: 82,
    width: 132,
    height: 52,
    unit: event.unit,
    series: [
      {
        name: event.average_label,
        color: COLORS.green,
        points: averagePoints,
      },
    ],
    emptyMessage: `No official ${event.average_label} results.`,
  });

  drawMilestones(doc, event, 12, 143, 176, 43);
  drawRecentRounds(doc, event.result_rows, 198, 143, 87, 43);
  drawFooter(doc);

  doc.save(`cubestats-${profile.wca_id}-${event.event_id}.pdf`);
}

export function exportComparisonReport({
  primary,
  secondary,
  eventId,
}: ComparisonReportArgs): void {
  const doc = createDoc();
  const primaryEvent = findEvent(primary, eventId);
  const secondaryEvent = findEvent(secondary, eventId);
  const eventName = primaryEvent?.name ?? secondaryEvent?.name ?? eventId;
  const averageLabel =
    primaryEvent?.average_label ?? secondaryEvent?.average_label ?? "Average";
  const unit = primaryEvent?.unit ?? secondaryEvent?.unit ?? "seconds";
  const headToHead = calculateHeadToHead(primary, secondary);

  drawHeader(doc, {
    title: "Cubestats comparison",
    subtitle: `${primary.name} (${primary.wca_id}) vs ${secondary.name} (${secondary.wca_id})`,
    meta: `${eventName} | Exported ${formatExportDate(new Date())}`,
  });

  drawHeadToHead(doc, primary, secondary, headToHead, 12, 35, 273, 24);

  drawComparisonTable(
    doc,
    {
      primary,
      secondary,
      primaryEvent,
      secondaryEvent,
      averageLabel,
    },
    12,
    66,
    112,
    108
  );

  drawLineChart(doc, {
    title: "Single PB progression",
    x: 134,
    y: 66,
    width: 151,
    height: 50,
    unit,
    series: [
      {
        name: primary.name,
        color: COLORS.primary,
        points: primaryEvent?.pb_progression ?? [],
      },
      {
        name: secondary.name,
        color: COLORS.secondary,
        points: secondaryEvent?.pb_progression ?? [],
      },
    ],
    emptyMessage: "No selected-event PB progression data.",
  });

  drawLineChart(doc, {
    title: `Best ${averageLabel} progression`,
    x: 134,
    y: 124,
    width: 151,
    height: 50,
    unit,
    series: [
      {
        name: primary.name,
        color: COLORS.primary,
        points: bestAverageProgression(primaryEvent?.average_points ?? []),
      },
      {
        name: secondary.name,
        color: COLORS.secondary,
        points: bestAverageProgression(secondaryEvent?.average_points ?? []),
      },
    ],
    emptyMessage: "No selected-event average progression data.",
  });

  drawFooter(doc);

  doc.save(
    `cubestats-${primary.wca_id}-vs-${secondary.wca_id}-${eventId}.pdf`
  );
}

function createDoc() {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  doc.setProperties({
    title: "Cubestats report",
    creator: "Cubestats",
  });
  return doc;
}

function drawHeader(
  doc: PdfDoc,
  {
    title,
    subtitle,
    meta,
  }: {
    title: string;
    subtitle: string;
    meta: string;
  }
) {
  setFill(doc, COLORS.ink);
  doc.rect(0, 0, PAGE.width, 27, "F");
  setText(doc, COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, PAGE.margin, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(truncateText(doc, subtitle, 170), PAGE.margin, 20);
  doc.text(truncateText(doc, meta, 86), PAGE.width - PAGE.margin, 13, {
    align: "right",
  });
}

function drawStatGrid(
  doc: PdfDoc,
  stats: { label: string; value: string }[],
  x: number,
  y: number,
  width: number,
  height: number,
  columns: number
) {
  const gap = 2;
  const cellWidth = (width - gap * (columns - 1)) / columns;
  const cellHeight = height / 2 - gap / 2;

  stats.forEach((stat, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const cellX = x + col * (cellWidth + gap);
    const cellY = y + row * (cellHeight + gap);
    drawPanel(doc, cellX, cellY, cellWidth, cellHeight);
    setText(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(truncateText(doc, stat.label, cellWidth - 4), cellX + 2, cellY + 5);
    setText(doc, COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(
      truncateText(doc, stat.value, cellWidth - 4),
      cellX + 2,
      cellY + 12
    );
  });
}

function drawLineChart(
  doc: PdfDoc,
  {
    title,
    x,
    y,
    width,
    height,
    unit,
    series,
    emptyMessage,
  }: {
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    unit: string;
    series: ChartSeries[];
    emptyMessage: string;
  }
) {
  drawPanel(doc, x, y, width, height);
  setText(doc, COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title, x + 4, y + 7);

  const chartX = x + 8;
  const chartY = y + 13;
  const chartWidth = width - 16;
  const chartHeight = height - 22;
  const normalized: NormalizedChartSeries[] = series.map((entry) => ({
    ...entry,
    points: entry.points.filter(isFinitePoint) as (ProgressionPoint & {
      value: number;
    })[],
  }));
  const allValues = normalized.flatMap((entry) =>
    entry.points.map((point) => point.value)
  );

  if (allValues.length === 0) {
    setText(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(emptyMessage, x + 4, y + height / 2);
    return;
  }

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const lowerIsBetter = isLowerBetterUnit(unit);
  const xScale = createChartXScale(normalized);

  setDraw(doc, COLORS.faint);
  doc.setLineWidth(0.2);
  for (let index = 0; index <= 3; index += 1) {
    const gridY = chartY + (chartHeight / 3) * index;
    doc.line(chartX, gridY, chartX + chartWidth, gridY);
  }

  setText(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(formatChartValue(lowerIsBetter ? min : max, unit), chartX, chartY - 2);
  doc.text(
    formatChartValue(lowerIsBetter ? max : min, unit),
    chartX,
    chartY + chartHeight + 5
  );

  normalized.forEach((entry, seriesIndex) => {
    if (entry.points.length === 0) {
      return;
    }
    setDraw(doc, entry.color);
    setFill(doc, entry.color);
    doc.setLineWidth(0.75);

    const coords = entry.points.map((point, index) => {
      const valueRatio = (point.value - min) / range;
      return {
        x: chartX + xScale(point, index, seriesIndex) * chartWidth,
        y: chartY + (lowerIsBetter ? valueRatio : 1 - valueRatio) * chartHeight,
      };
    });

    for (let index = 1; index < coords.length; index += 1) {
      doc.line(coords[index - 1].x, coords[index - 1].y, coords[index].x, coords[index].y);
    }

    const last = coords[coords.length - 1];
    doc.circle(last.x, last.y, 1.2, "F");

    const legendX = x + width - 48;
    const legendY = y + 6 + seriesIndex * 5;
    doc.rect(legendX, legendY - 2.2, 3, 3, "F");
    setText(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(truncateText(doc, entry.name, 38), legendX + 5, legendY);
  });
}

function drawMilestones(
  doc: PdfDoc,
  event: EventProgression,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const milestones = buildMilestones(event);
  drawPanel(doc, x, y, width, height);
  setText(doc, COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Records and milestones", x + 4, y + 7);

  const cards = [
    {
      label: "Single PBs set",
      value: milestones.pbCount ? milestones.pbCount.toLocaleString() : "N/A",
    },
    {
      label: "Competing since",
      value: milestones.debutDate ? monthYear(milestones.debutDate) : "N/A",
    },
    {
      label: "Biggest PB drop",
      value: milestones.biggestDrop
        ? formatDelta(milestones.biggestDrop.delta, event.unit)
        : "N/A",
    },
    {
      label: "Longest PB gap",
      value: milestones.longestGap
        ? formatGap(milestones.longestGap.days)
        : "N/A",
    },
  ];

  const cardWidth = (width - 14) / 4;
  cards.forEach((card, index) => {
    const cardX = x + 4 + index * (cardWidth + 2);
    setFill(doc, COLORS.white);
    setDraw(doc, COLORS.faint);
    doc.roundedRect(cardX, y + 11, cardWidth, 16, 1.5, 1.5, "FD");
    setText(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(truncateText(doc, card.label, cardWidth - 4), cardX + 2, y + 16);
    setText(doc, COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(truncateText(doc, card.value, cardWidth - 4), cardX + 2, y + 23);
  });

  if (milestones.barriers.length === 0) {
    return;
  }

  let chipX = x + 4;
  const chipY = y + 33;
  for (const barrier of milestones.barriers.slice(0, 5)) {
    const label = `${barrierLabel(barrier.threshold, event.unit)} ${monthYear(
      barrier.date
    )}`;
    const chipWidth = Math.min(33, doc.getTextWidth(label) + 6);
    if (chipX + chipWidth > x + width - 4) {
      break;
    }
    setFill(doc, COLORS.panelDark);
    doc.roundedRect(chipX, chipY, chipWidth, 6.5, 3, 3, "F");
    setText(doc, COLORS.ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.text(truncateText(doc, label, chipWidth - 4), chipX + 2, chipY + 4.4);
    chipX += chipWidth + 2;
  }
}

function drawRecentRounds(
  doc: PdfDoc,
  rows: ResultRow[],
  x: number,
  y: number,
  width: number,
  height: number
) {
  drawPanel(doc, x, y, width, height);
  setText(doc, COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Recent rounds", x + 4, y + 7);

  const recentRows = rows
    .filter((row) => row.date)
    .slice()
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 4);

  if (recentRows.length === 0) {
    setText(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("No dated recent rounds.", x + 4, y + 23);
    return;
  }

  recentRows.forEach((row, index) => {
    const rowY = y + 15 + index * 6.5;
    setText(doc, COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(truncateText(doc, row.competition_name, 48), x + 4, rowY);
    setText(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.text(shortDate(row.date), x + width - 4, rowY, { align: "right" });
    doc.text(
      truncateText(
        doc,
        `${row.round}: best ${valueOrNa(row.best.display)}, avg ${valueOrNa(
          row.average.display
        )}`,
        width - 8
      ),
      x + 4,
      rowY + 3.5
    );
  });
}

function drawHeadToHead(
  doc: PdfDoc,
  primary: CompetitorProgression,
  secondary: CompetitorProgression,
  headToHead: { primaryWins: number; secondaryWins: number; ties: number; shared: number },
  x: number,
  y: number,
  width: number,
  height: number
) {
  drawPanel(doc, x, y, width, height);
  setText(doc, COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Head-to-head single PB record", x + 4, y + 8);

  setText(doc, COLORS.primary);
  doc.setFontSize(17);
  doc.text(String(headToHead.primaryWins), x + 5, y + 19);
  setText(doc, COLORS.ink);
  doc.text("-", x + 22, y + 19);
  setText(doc, COLORS.secondary);
  doc.text(String(headToHead.secondaryWins), x + 30, y + 19);

  setText(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const tieText = headToHead.ties ? `, ${headToHead.ties} tied` : "";
  const summary =
    headToHead.shared > 0
      ? `${primary.name} vs ${secondary.name} across ${headToHead.shared} shared events${tieText}.`
      : "No shared events with single PB data.";
  doc.text(truncateText(doc, summary, width - 52), x + 48, y + 17);
}

function drawComparisonTable(
  doc: PdfDoc,
  {
    primary,
    secondary,
    primaryEvent,
    secondaryEvent,
    averageLabel,
  }: {
    primary: CompetitorProgression;
    secondary: CompetitorProgression;
    primaryEvent: EventProgression | null;
    secondaryEvent: EventProgression | null;
    averageLabel: string;
  },
  x: number,
  y: number,
  width: number,
  height: number
) {
  drawPanel(doc, x, y, width, height);
  setText(doc, COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Selected event comparison", x + 4, y + 7);

  const a = primaryEvent?.stats ?? null;
  const b = secondaryEvent?.stats ?? null;
  const rows = [
    ["Single PB", a?.current_pb, b?.current_pb],
    [`Best ${averageLabel}`, a?.best_average, b?.best_average],
    ["National single rank", rankDisplay(a?.single_rank), rankDisplay(b?.single_rank)],
    ["Average solve", a?.average_solve, b?.average_solve],
    ["Consistency", a?.solve_std_dev, b?.solve_std_dev],
    ["DNF rate", a ? formatDnfRate(a) : null, b ? formatDnfRate(b) : null],
    [
      "Competitions",
      a ? a.competition_count.toLocaleString() : null,
      b ? b.competition_count.toLocaleString() : null,
    ],
    [
      "Official solves",
      a ? a.solve_count.toLocaleString() : null,
      b ? b.solve_count.toLocaleString() : null,
    ],
  ];

  const labelWidth = 41;
  const valueWidth = (width - 12 - labelWidth) / 2;
  const rowHeight = 10.5;
  const startY = y + 20;

  setText(doc, COLORS.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("Metric", x + 4, y + 14);
  doc.text(truncateText(doc, primary.name, valueWidth), x + 5 + labelWidth, y + 14);
  doc.text(
    truncateText(doc, secondary.name, valueWidth),
    x + 5 + labelWidth + valueWidth,
    y + 14
  );

  rows.forEach(([label, primaryValue, secondaryValue], index) => {
    const rowY = startY + index * rowHeight;
    if (index % 2 === 0) {
      setFill(doc, COLORS.white);
      doc.rect(x + 3, rowY - 5, width - 6, rowHeight, "F");
    }
    setText(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.text(truncateText(doc, label ?? "", labelWidth - 2), x + 4, rowY);
    setText(doc, COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.text(
      truncateText(doc, valueOrNa(primaryValue), valueWidth - 2),
      x + 5 + labelWidth,
      rowY
    );
    doc.text(
      truncateText(doc, valueOrNa(secondaryValue), valueWidth - 2),
      x + 5 + labelWidth + valueWidth,
      rowY
    );
  });
}

function drawFooter(doc: PdfDoc) {
  setText(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(FOOTER_TEXT, PAGE.margin, PAGE.footerY);
}

function drawPanel(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  height: number
) {
  setFill(doc, COLORS.panel);
  setDraw(doc, COLORS.faint);
  doc.roundedRect(x, y, width, height, 2, 2, "FD");
}

function setText(doc: PdfDoc, color: RgbColor) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setFill(doc: PdfDoc, color: RgbColor) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setDraw(doc: PdfDoc, color: RgbColor) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function findEvent(profile: CompetitorProgression, eventId: string) {
  return profile.events.find((event) => event.event_id === eventId) ?? null;
}

function calculateHeadToHead(
  primary: CompetitorProgression,
  secondary: CompetitorProgression
) {
  const secondaryById = new Map(
    secondary.events.map((event) => [event.event_id, event])
  );
  let primaryWins = 0;
  let secondaryWins = 0;
  let ties = 0;
  let shared = 0;

  for (const event of primary.events) {
    const other = secondaryById.get(event.event_id);
    const a = event.stats.current_pb_value;
    const b = other?.stats.current_pb_value ?? null;
    if (a === null || b === null) {
      continue;
    }

    shared += 1;
    const higherIsBetter = isHigherBetterEvent(event);
    if ((higherIsBetter && a > b) || (!higherIsBetter && a < b)) {
      primaryWins += 1;
    } else if ((higherIsBetter && b > a) || (!higherIsBetter && b < a)) {
      secondaryWins += 1;
    } else {
      ties += 1;
    }
  }

  return { primaryWins, secondaryWins, ties, shared };
}

function bestAverageProgression(points: ProgressionPoint[]) {
  const progression: ProgressionPoint[] = [];
  let best = Infinity;

  for (const point of points) {
    if (typeof point.value === "number" && Number.isFinite(point.value) && point.value < best) {
      best = point.value;
      progression.push(point);
    }
  }

  return progression;
}

function buildMilestones(event: EventProgression) {
  const points = event.pb_progression.filter(isFinitePoint);
  let biggestDrop: { delta: number; point: ProgressionPoint } | null = null;

  for (let index = 1; index < points.length; index += 1) {
    const previousValue = points[index - 1].value as number;
    const currentValue = points[index].value as number;
    const delta = previousValue - currentValue;
    if (delta > 0 && (!biggestDrop || delta > biggestDrop.delta)) {
      biggestDrop = { delta, point: points[index] };
    }
  }

  const datedPoints = points.filter(
    (point): point is ProgressionPoint & { date: string } => Boolean(point.date)
  );
  let longestGap: { days: number; from: ProgressionPoint; to: ProgressionPoint } | null =
    null;

  for (let index = 1; index < datedPoints.length; index += 1) {
    const days = dayDiff(datedPoints[index - 1].date, datedPoints[index].date);
    if (days !== null && (!longestGap || days > longestGap.days)) {
      longestGap = {
        days,
        from: datedPoints[index - 1],
        to: datedPoints[index],
      };
    }
  }

  const currentPb = event.stats.current_pb_value;
  const barriers =
    currentPb === null
      ? []
      : barrierThresholds(event.unit)
          .filter((threshold) => currentPb < threshold)
          .slice(0, 5)
          .map((threshold) => ({
            threshold,
            date:
              points.find((point) => (point.value as number) < threshold)
                ?.date ?? null,
          }));

  return {
    pbCount: points.length,
    debutDate: event.stats.first_date,
    biggestDrop,
    longestGap,
    barriers,
  };
}

function barrierThresholds(unit: string) {
  if (unit === "seconds") {
    return [4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 30, 60];
  }

  if (unit === "moves") {
    return [20, 22, 24, 26, 28, 30, 35, 40];
  }

  return [];
}

function barrierLabel(threshold: number, unit: string) {
  if (unit === "moves") {
    return `sub-${threshold} moves`;
  }

  return `sub-${threshold}`;
}

function isFinitePoint(point: ProgressionPoint) {
  return typeof point.value === "number" && Number.isFinite(point.value);
}

function createChartXScale(series: NormalizedChartSeries[]) {
  const datedValues = series
    .flatMap((entry) => entry.points.map((point) => dateTime(point.date)))
    .filter((value): value is number => value !== null);
  const uniqueDates = Array.from(new Set(datedValues));

  if (uniqueDates.length >= 2) {
    const minDate = Math.min(...uniqueDates);
    const maxDate = Math.max(...uniqueDates);
    const dateRange = maxDate - minDate || 1;
    return (
      point: ProgressionPoint,
      pointIndex: number,
      seriesIndex: number
    ) => {
      const pointTime = dateTime(point.date);
      if (pointTime !== null) {
        return clamp01((pointTime - minDate) / dateRange);
      }

      return fallbackPointRatio(series, pointIndex, seriesIndex);
    };
  }

  return (
    _point: ProgressionPoint,
    pointIndex: number,
    seriesIndex: number
  ) => fallbackPointRatio(series, pointIndex, seriesIndex);
}

function fallbackPointRatio(
  series: NormalizedChartSeries[],
  pointIndex: number,
  seriesIndex: number
) {
  const maxPointCount = Math.max(
    ...series.map((entry) => entry.points.length),
    1
  );
  if (maxPointCount <= 1) {
    const divisor = Math.max(series.length - 1, 1);
    return divisor === 0 ? 0 : seriesIndex / divisor;
  }

  return clamp01(pointIndex / (maxPointCount - 1));
}

function dateTime(date: string | null) {
  if (!date) {
    return null;
  }

  const time = new Date(date).getTime();
  return Number.isFinite(time) ? time : null;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function isLowerBetterUnit(unit: string) {
  return unit !== "score";
}

function isHigherBetterEvent(event: EventProgression) {
  return event.unit === "score" || event.event_id === "333mbf";
}

function valueOrNa(value: string | null | undefined) {
  return value && value.trim() ? value : "N/A";
}

function rankValue(value: number | null | undefined) {
  return typeof value === "number" && value > 0 ? `#${value.toLocaleString()}` : "N/A";
}

function rankDisplay(rank?: RankPositions | null) {
  return rankValue(rank?.country);
}

function formatChartValue(value: number, unit: string) {
  if (unit === "seconds") {
    if (value >= 60) {
      const minutes = Math.floor(value / 60);
      const seconds = value % 60;
      return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
    }
    return `${value.toFixed(2)}s`;
  }

  if (unit === "moves") {
    return `${value.toFixed(1)} moves`;
  }

  return value.toFixed(2);
}

function formatDelta(delta: number, unit: string) {
  const prefix = "-";
  if (unit === "seconds") {
    return delta < 60 ? `${prefix}${delta.toFixed(2)}s` : `${prefix}${formatChartValue(delta, unit)}`;
  }

  if (unit === "moves") {
    return `${prefix}${Number.isInteger(delta) ? delta : delta.toFixed(2)} moves`;
  }

  return `${prefix}${delta.toFixed(2)}`;
}

function formatGap(days: number) {
  if (days < 30) {
    return `${Math.max(days, 0)}d`;
  }

  const months = Math.round(days / 30.44);
  if (months < 12) {
    return `${months}mo`;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths ? `${years}y ${remainingMonths}mo` : `${years}y`;
}

function dayDiff(start: string, end: string) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return null;
  }

  return Math.round((endTime - startTime) / 86400000);
}

function monthYear(date: string | null) {
  if (!date) {
    return "Unknown";
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function shortDate(date: string | null) {
  if (!date) {
    return "N/A";
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "2-digit",
    timeZone: "UTC",
  }).format(parsed);
}

function formatExportDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function truncateText(doc: PdfDoc, text: string, maxWidth: number) {
  if (doc.getTextWidth(text) <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (truncated.length > 1 && doc.getTextWidth(`${truncated}...`) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
}
