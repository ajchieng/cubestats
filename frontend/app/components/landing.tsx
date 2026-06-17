const EXAMPLE_COMPETITORS: { wcaId: string; name: string; note: string }[] = [
  { wcaId: "2009ZEMD01", name: "Feliks Zemdegs", note: "All-time great across every event" },
  { wcaId: "2016PARK06", name: "Max Park", note: "3x3 & big-cube record holder" },
  { wcaId: "2017KOLA02", name: "Tymon Kolasiński", note: "3x3 & 2x2 specialist" },
  { wcaId: "2008VALK01", name: "Mats Valk", note: "Former 3x3 world-record holder" },
];

export function LandingPanel({ onPick }: { onPick: (wcaId: string) => void }) {
  return (
    <section className="landing" aria-label="Getting started">
      <p className="eyebrow">Get started</p>
      <h2>Look up any WCA competitor</h2>
      <p className="landing-lead">
        Enter a competitor&apos;s WCA ID above to see their personal-best
        progression, per-event stats, an all-around profile, and more. New here?
        Try one of these:
      </p>

      <div className="example-grid">
        {EXAMPLE_COMPETITORS.map((example) => (
          <button
            type="button"
            className="example-card"
            key={example.wcaId}
            onClick={() => onPick(example.wcaId)}
          >
            <span className="example-card-name">{example.name}</span>
            <span className="example-card-id">{example.wcaId}</span>
            <span className="example-card-note">{example.note}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
