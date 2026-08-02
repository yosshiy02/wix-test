import { Designer } from "@pdfme/ui";
import { line, table, text } from "@pdfme/schemas";
import { getDynamicHeightsForTable } from "@pdfme/schemas/utils";
import { generate } from "@pdfme/generator";
import { getDynamicTemplate } from "@pdfme/common";
import { PDFDocument } from "@pdfme/pdf-lib";

window.PdfmeLocal = Object.freeze({
  Designer,
  generate,
  getDynamicTemplate,
  getDynamicHeightsForTable,
  PDFDocument,
  plugins: Object.freeze({ line, table, text })
});