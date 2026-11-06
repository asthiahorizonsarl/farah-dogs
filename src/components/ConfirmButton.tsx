"use client";

import type { ComponentProps } from "react";

/** Bouton de formulaire qui demande une confirmation avant l'envoi. */
export function ConfirmButton({ message, ...props }: ComponentProps<"button"> & { message: string }) {
  return (
    <button
      {...props}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    />
  );
}
