export default function ListLoading() {
  return (
    <div className="glass-page -mx-6 -my-8 px-6 py-8 md:-mx-10 md:px-10">
      <div className="glass-header">
        <div className="h-7 w-40 rounded bg-white/10" />
        <div className="mt-3 h-4 w-64 rounded bg-white/10" />
      </div>
      <div className="gallery-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="gallery-card">
            <div className="h-44 w-full rounded-[18px] bg-white/10" />
            <div className="h-12 w-full rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
