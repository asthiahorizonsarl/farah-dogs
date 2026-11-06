"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ClipboardList, Dog, Gift, HandCoins, LayoutDashboard, LogOut, Menu, Settings, Users, X } from "lucide-react";
import { deconnecter } from "@/app/connexion/actions";

const liens = [
  { href: "/", label: "Tableau de bord", icone: LayoutDashboard, exact: true },
  { href: "/membres", label: "Membres", icone: Users },
  { href: "/chiens", label: "Chiens", icone: Dog },
  { href: "/suivis", label: "Suivis", icone: ClipboardList },
  { href: "/cotisations", label: "Cotisations", icone: HandCoins },
  { href: "/dons", label: "Dons", icone: Gift },
  { href: "/parametres", label: "Paramètres", icone: Settings },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 px-2">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white p-1">
        <Image src="/brand/icone.png" alt="" width={32} height={32} priority />
      </span>
      <span className="leading-tight">
        <Image src="/brand/logo-texte-blanc.png" alt="Farah Dogs" width={120} height={12} className="h-3.5 w-auto" priority />
        <span className="mt-1 block text-[11px] text-white/50">chiens d&apos;assistance</span>
      </span>
    </Link>
  );
}

export function Sidebar() {
  const path = usePathname();
  const [ouvert, setOuvert] = useState(false);
  if (path === "/connexion") return null;

  const sortie = (
    <form action={deconnecter}>
      <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/60 hover:bg-white/5 hover:text-white">
        <LogOut className="size-[18px] text-white/40" /> Se déconnecter
      </button>
    </form>
  );

  const nav = (
    <nav className="mt-8 flex flex-col gap-1">
      {liens.map(({ href, label, icone: Icone, exact }) => {
        const actif = exact ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOuvert(false)}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              actif ? "bg-white/10 font-medium text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icone className={`size-[18px] ${actif ? "text-brand-500" : "text-white/40 group-hover:text-white/70"}`} />
            {label}
            {actif && <span className="ml-auto size-1.5 rounded-full bg-brand-500" />}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Barre du haut (mobile) */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
        <Logo />
        <button onClick={() => setOuvert(true)} className="rounded-lg p-2 text-white/80 hover:bg-white/10" aria-label="Ouvrir le menu">
          <Menu className="size-5" />
        </button>
      </div>

      {/* Menu mobile */}
      {ouvert && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOuvert(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-ink p-4">
            <div className="flex items-center justify-between">
              <Logo />
              <button onClick={() => setOuvert(false)} className="rounded-lg p-2 text-white/80 hover:bg-white/10" aria-label="Fermer le menu">
                <X className="size-5" />
              </button>
            </div>
            {nav}
            <div className="mt-6">{sortie}</div>
          </aside>
        </div>
      )}

      {/* Barre latérale (ordinateur) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink p-4 lg:flex">
        <div className="pt-2"><Logo /></div>
        {nav}
        <div className="mt-auto">{sortie}</div>
        <div className="mt-2 rounded-xl bg-white/5 p-3 text-xs text-white/50">
          Gestion de l&apos;association
          <br />
          <a href="https://farah-dogs.ch" target="_blank" rel="noreferrer" className="text-white/70 hover:text-white">farah-dogs.ch ↗</a>
        </div>
      </aside>
    </>
  );
}
