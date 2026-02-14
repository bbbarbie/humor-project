type FuturisticBackgroundProps = {
  dim?: boolean;
};

export default function FuturisticBackground({ dim = true }: FuturisticBackgroundProps) {
  return (
    <div className="futuristic-background" aria-hidden="true">
      <div className="futuristic-aurora" />
      <div className="futuristic-conic-glow" />
      <div className="futuristic-grid" />
      <div className="futuristic-shimmer" />
      <div className="futuristic-scanlines" />
      {dim ? <div className="futuristic-dim" /> : null}
    </div>
  );
}
