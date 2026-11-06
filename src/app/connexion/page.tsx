import Image from "next/image";
import { LogIn } from "lucide-react";
import { connecter } from "./actions";

export const metadata = { title: "Connexion" };

export default async function Connexion({ searchParams }: PageProps<"/connexion">) {
  const sp = await searchParams;
  return (
    <div className="grid min-h-[80vh] place-items-center">
      <form action={connecter} className="carte w-full max-w-sm space-y-5 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/brand/logo.png" alt="Farah Dogs" width={96} height={96} priority />
          <div>
            <h1 className="text-xl font-semibold">Gestion Farah Dogs</h1>
            <p className="text-sm text-stone-500">Connectez-vous pour continuer.</p>
          </div>
        </div>
        {sp.erreur && <p className="notice-erreur">Identifiant ou mot de passe incorrect.</p>}
        {sp.ok && <p className="notice-ok">Mot de passe changé. Reconnectez-vous.</p>}
        <input type="hidden" name="suite" value={typeof sp.suite === "string" ? sp.suite : "/"} />
        <label className="flex flex-col gap-1.5">
          <span className="etiquette">Identifiant</span>
          <input name="identifiant" autoComplete="username" autoFocus required className="champ" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="etiquette">Mot de passe</span>
          <input name="motDePasse" type="password" autoComplete="current-password" required className="champ" />
        </label>
        <button className="btn-principal w-full"><LogIn /> Se connecter</button>
      </form>
    </div>
  );
}
