import "server-only";
import { convertirDocxEnPdf } from "./docx-pdf";

/** Convertit un document Word (.docx) en PDF (JavaScript pur, voir docx-pdf.ts). */
export async function wordEnPdf(docx: Buffer): Promise<Buffer> {
  try {
    return await convertirDocxEnPdf(docx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[PDF] conversion impossible : ${msg}`);
    throw new Error(`Conversion du Word en PDF impossible : ${msg.slice(0, 200)}`);
  }
}
