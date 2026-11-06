import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** En-tête de page : retour, titre, sous-titre et actions. */
export function PageHeader({
  titre, sousTitre, actions, retour, avant,
}: {
  titre: React.ReactNode;
  sousTitre?: React.ReactNode;
  actions?: React.ReactNode;
  retour?: { href: string; label: string };
  avant?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      {retour && (
        <Link href={retour.href} className="mb-3 inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900">
          <ArrowLeft className="size-4" /> {retour.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {avant}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{titre}</h1>
            {sousTitre && <div className="mt-1 text-sm text-stone-500">{sousTitre}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Onglets basés sur l'adresse (?onglet=…). */
export function Onglets({ items }: { items: { href: string; label: string; nombre?: number; actif: boolean }[] }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-stone-200">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          scroll={false}
          className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition ${
            i.actif ? "border-brand-600 font-medium text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          {i.label}
          {i.nombre !== undefined && (
            <span className={`rounded-full px-1.5 text-xs ${i.actif ? "bg-brand-50 text-brand-700" : "bg-stone-100 text-stone-500"}`}>{i.nombre}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

/** Bloc titré à l'intérieur d'un formulaire. */
export function Section({ titre, icone, children, className = "" }: { titre: string; icone?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`carte p-5 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-stone-900 [&_svg]:size-4 [&_svg]:text-brand-600">
        {icone}
        {titre}
      </h2>
      {children}
    </section>
  );
}

export function Champ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="etiquette">{label}</span>
      {children}
    </label>
  );
}

export function Avatar({ texte, className = "" }: { texte: string; className?: string }) {
  const initiales = texte
    .split(/[\s-]+/)
    .filter((m) => /\p{L}/u.test(m))
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join("");
  return (
    <span className={`grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-lg font-semibold text-brand-700 ring-1 ring-brand-100 ${className}`}>
      {initiales || "?"}
    </span>
  );
}

export function Kpi({ label, valeur, detail, icone, href }: { label: string; valeur: React.ReactNode; detail?: React.ReactNode; icone: React.ReactNode; href?: string }) {
  const contenu = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-500">{label}</span>
        <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600 [&_svg]:size-[18px]">{icone}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-stone-900 tabular-nums">{valeur}</div>
      {detail && <div className="mt-1 text-xs text-stone-500">{detail}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="carte block p-5 transition hover:-translate-y-0.5 hover:shadow-md">{contenu}</Link>
  ) : (
    <div className="carte p-5">{contenu}</div>
  );
}

export function Vide({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-stone-200 px-4 py-6 text-center text-sm text-stone-500">{children}</p>;
}
