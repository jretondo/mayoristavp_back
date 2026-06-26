import ControllerInvoices from '../../api/components/invoices';
import { NextFunction, Request, Response } from 'express';
import { INewPV } from 'interfaces/Irequests';
import { IFactura } from 'interfaces/Itables';
import { AfipClass, CbteTipos, DocTipos } from './AfipClass';

export const fiscalMiddle = () => {
  const middleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      let asociado = null;
      const pvData: INewPV = req.body.pvData;
      const newFact: IFactura = req.body.newFact;
      const dataFiscal:
        | FactInscriptoProd
        | FactInscriptoProdNC
        | FactInscriptoServ
        | FactInscriptoServNC
        | FactMonotribProd
        | FactMonotribProdNC
        | FactMonotribServ
        | FactMonotribServNC
        | any = req.body.dataFiscal;
      if (dataFiscal.CbtesAsoc) {
        asociado = dataFiscal.CbtesAsoc;
        try {
          if (
            Number(asociado[0].Cuit) === 0 &&
            Number(newFact.n_doc_cliente) !== 0
          ) {
            asociado[0].Cuit = newFact.n_doc_cliente;
          } else {
            asociado[0] = {
              Tipo: asociado[0].Tipo,
              PtoVta: asociado[0].PtoVta,
              Nro: asociado[0].Nro,
            };
          }
        } catch (error) {}
      }

      if (newFact.fiscal) {
        if (Number(dataFiscal.DocTipo) === DocTipos['Sin identificar']) {
          dataFiscal.DocNro = 0;
        }

        let certDir = 'drop_test.crt';
        let keyDir = 'drop.key';
        let entornoAlt = false;

        if (process.env.ENTORNO === 'PROD') {
          certDir = pvData.cert_file || 'drop_test.crt';
          keyDir = pvData.key_file || 'drop.key';
          entornoAlt = true;
        }
        const afip = new AfipClass(
          newFact.cuit_origen,
          certDir,
          keyDir,
          entornoAlt,
        );

        console.log('[AFIP][middleFiscal][beforeNewFact]', safeJson({
          endpoint: req.originalUrl,
          userId: req.body.user_id,
          pv: {
            id: pvData.id,
            pv: pvData.pv,
            cond_iva: pvData.cond_iva,
            cuit: pvData.cuit,
          },
          factura: {
            letra: newFact.letra,
            t_fact: newFact.t_fact,
            fiscal: newFact.fiscal,
            total_fact: newFact.total_fact,
            total_neto: newFact.total_neto,
            total_iva: newFact.total_iva,
            tipo_doc_cliente: newFact.tipo_doc_cliente,
            n_doc_cliente: newFact.n_doc_cliente,
            cond_iva_cliente: newFact.cond_iva_cliente,
          },
          dataFiscal,
          productsList: req.body.productsList,
        }));

        const newDataFiscal = await afip.newFact(dataFiscal);

        console.log('[AFIP][middleFiscal][afterNewFact]', safeJson({
          status: newDataFiscal.status,
          data: newDataFiscal.data,
        }));

        if (Number(newDataFiscal.status) !== 200) {
          throw new Error(`AFIP rechazo la factura: ${newDataFiscal.data}`);
        }

        req.body.dataFiscal = newDataFiscal.data;
        req.body.dataFiscal.CbteTipo = String(newFact.t_fact);
        req.body.newFact.cbte = req.body.dataFiscal.CbteDesde;
        if (asociado) {
          req.body.dataFiscal.CbtesAsoc = asociado;
        }

        next();
      } else {
        const lastInvoice = await ControllerInvoices.lastInvoice(
          pvData.id || 0,
          false,
          0,
          false,
        );
        newFact.cbte;
        req.body.newFact.cbte = lastInvoice.lastInvoice + 1;
        next();
      }
    } catch (error) {
      console.error('[AFIP][middleFiscal][error]', safeJson({
        endpoint: req.originalUrl,
        userId: req.body.user_id,
        error: serializeError(error),
        dataFiscal: req.body.dataFiscal,
        dataFiscalIva: req.body.dataFiscal && req.body.dataFiscal.Iva,
        newFact: req.body.newFact,
        pvData: req.body.pvData,
        productsList: req.body.productsList,
      }));
      next(new Error('Faltan datos o hay datos erroneos, controlelo!'));
    }
  };
  return middleware;
};

const serializeError = (error: any) => {
  if (!error) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: error.stack,
    response: error.response,
    fault: error.fault,
    details: error.details,
    errors: error.errors,
    raw: error,
  };
};

const safeJson = (data: any): string => {
  const seen = new WeakSet();

  try {
    return JSON.stringify(
      data,
      (_key, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }

        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }

        return value;
      },
      2,
    );
  } catch (error) {
    return String(data);
  }
};
