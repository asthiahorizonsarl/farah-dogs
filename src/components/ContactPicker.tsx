"use client";

import { useId, useMemo, useState } from "react";

export type Choix = { id: number; libelle: string };

/**
 * Champ de recherche avec suggestions ; envoie l'ID choisi dans un champ caché `name`.
 * Utilisé pour choisir un membre (≈700 fiches) ou un chien.
 */
export function Picker({
  name, choix, defautId, placeholder, required,
}: { name: string; choix: Choix[]; defautId?: number | null; placeholder?: string; required?: boolean }) {
  const listId = useId();
  const parLibelle = useMemo(() => new Map(choix.map((c) => [c.libelle, c.id])), [choix]);
  const initial = choix.find((c) => c.id === defautId)?.libelle ?? "";
  const [texte, setTexte] = useState(initial);
  const id = parLibelle.get(texte);
  return (
    <>
      <input
        className={`champ ${texte && !id ? "border-amber-400" : ""}`}
        list={listId}
        value={texte}
        placeholder={placeholder}
        onChange={(e) => setTexte(e.target.value)}
        required={required}
        title={texte && !id ? "Choisissez une proposition de la liste" : undefined}
      />
      <datalist id={listId}>
        {choix.map((c) => <option key={c.id} value={c.libelle} />)}
      </datalist>
      <input type="hidden" name={name} value={id ?? ""} />
    </>
  );
}
