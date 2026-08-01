import fs from 'fs';
import path from 'path';

const INVOICE_PDF_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export const startInvoicePdfCleanup = () => {
  cleanupInvoicePdfs();
  setInterval(cleanupInvoicePdfs, CLEANUP_INTERVAL_MS);
};

const cleanupInvoicePdfs = () => {
  const dir = path.join('public', 'invoices');

  if (!fs.existsSync(dir)) {
    return;
  }

  fs.readdir(dir, (readError, files) => {
    if (readError) {
      console.error('[INVOICE_PDF_CLEANUP][readError]', readError);
      return;
    }

    files
      .filter((file) => file.toLowerCase().endsWith('.pdf'))
      .forEach((file) => {
        const filePath = path.join(dir, file);
        fs.stat(filePath, (statError, stat) => {
          if (statError) {
            console.error('[INVOICE_PDF_CLEANUP][statError]', {
              filePath,
              error: statError,
            });
            return;
          }

          if (Date.now() - stat.mtimeMs <= INVOICE_PDF_MAX_AGE_MS) {
            return;
          }

          fs.unlink(filePath, (unlinkError) => {
            if (unlinkError) {
              console.error('[INVOICE_PDF_CLEANUP][unlinkError]', {
                filePath,
                error: unlinkError,
              });
            }
          });
        });
      });
  });
};
