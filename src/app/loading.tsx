export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Chargement">
      <div className="h-8 w-64 rounded-lg bg-stone-200/70" />
      <div className="h-4 w-96 max-w-full rounded bg-stone-200/50" />
      <div className="mt-6 h-64 rounded-2xl bg-white" />
    </div>
  );
}
