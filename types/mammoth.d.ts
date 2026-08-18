/**
 * mammoth has no published type declarations (no bundled .d.ts, no
 * @types/mammoth package) — this covers only the browser API surface this
 * app actually uses (docx -> HTML conversion for the file preview modal).
 */
declare module "mammoth" {
  export interface ConvertToHtmlResult {
    value: string;
    messages: unknown[];
  }

  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<ConvertToHtmlResult>;
}
