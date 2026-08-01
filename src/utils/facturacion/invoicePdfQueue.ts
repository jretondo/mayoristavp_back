import { IFactura } from 'interfaces/Itables';
import { sendInvoice } from '../sendEmails/sendInvoice';
import { createInvoicePdfFromHtml } from './middlePDFinvoice';

interface InvoicePdfJob {
  html: string;
  filePath: string;
  fileName: string;
  email?: {
    factura: IFactura;
    formaPago: string;
  };
}

const queue: InvoicePdfJob[] = [];
let processing = false;

export const enqueueInvoicePdf = (job: InvoicePdfJob) => {
  queue.push(job);
  processQueue();
};

const processQueue = async () => {
  if (processing) {
    return;
  }

  processing = true;

  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) {
      continue;
    }

    try {
      await createInvoicePdfFromHtml(job.html, job.filePath);
      await sendInvoiceIfNeeded(job);
    } catch (error) {
      console.error('[INVOICE_PDF_QUEUE][error]', {
        fileName: job.fileName,
        filePath: job.filePath,
        error,
      });
    }
  }

  processing = false;
};

const sendInvoiceIfNeeded = async (job: InvoicePdfJob) => {
  if (!job.email || !job.email.factura.email_cliente) {
    return;
  }

  const factura = job.email.factura;
  await sendInvoice(
    job.filePath,
    job.fileName,
    factura.nota_cred,
    factura.total_fact,
    factura.email_cliente,
    job.email.formaPago,
    factura.raz_soc_cliente,
    factura.tipo_doc_cliente,
    factura.n_doc_cliente,
  );
};
