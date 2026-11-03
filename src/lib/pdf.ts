import type { Layout as LayoutType } from '@/config/doctypes';
import { getLanguageByCode } from '@/config/languages';

/**
 * Prepares the document view for browser native print-to-PDF.
 * Configures font family according to the script and layout class.
 */
export function exportToPdf(layout: LayoutType, langCode: string) {
  if (typeof window === 'undefined') return;

  const langDef = getLanguageByCode(langCode);
  const printContainer = document.getElementById('munshi-document-preview');

  if (printContainer) {
    // Apply font family dynamically
    if (langDef && langDef.fontFamily) {
      printContainer.style.fontFamily = langDef.fontFamily;
    }
  }

  // Trigger browser native print dialog
  window.print();
}
