declare module "html-to-pdfmake" {
  // Convertit du HTML en contenu pdfmake (voir https://github.com/Aymkdn/html-to-pdfmake).
  export default function htmlToPdfmake(html: string, options?: Record<string, unknown>): unknown;
}
