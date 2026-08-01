import { Router, NextFunction, Response, Request } from 'express';
import { file, success } from '../../../network/response';
const router = Router();
import Controller from './index';
import secure from '../../../auth/secure';
import { EPermissions } from '../../../enums/EfunctMysql';
import factuMiddel from '../../../utils/facturacion/middleFactu';
import { fiscalMiddle } from '../../../utils/facturacion/middleFiscal';
import {
  invoiceHTMLMiddle,
  invoicePDFMiddle,
} from '../../../utils/facturacion/middlePDFinvoice';
import { sendFactMiddle } from '../../../utils/facturacion/middleSendFact';
import dataFactMiddle from '../../../utils/facturacion/middleDataFact';
import devFactMiddle from '../../../utils/facturacion/middleDevFact';
import factuMiddelDevPart from '../../../utils/facturacion/middleFactuDevPart';
import { enqueueInvoicePdf } from '../../../utils/facturacion/invoicePdfQueue';
import { zfill } from '../../../utils/cerosIzq';
import fs from 'fs';
import path from 'path';

const list = (req: Request, res: Response, next: NextFunction) => {
  Controller.list(
    req.query.pvId ? Number(req.query.pvId) : undefined,
    Number(req.query.fiscal),
    Number(req.query.cbte),
    Number(req.params.page),
    String(req.query.search),
    Number(req.query.cantPerPage),
  )
    .then((lista: any) => {
      success({
        req,
        res,
        status: 200,
        message: lista,
      });
    })
    .catch(next);
};

const remove = (req: Request, res: Response, next: NextFunction) => {
  Controller.remove(Number(req.params.id))
    .then(() => {
      success({ req, res });
    })
    .catch(next);
};

const get = (req: Request, res: Response, next: NextFunction) => {
  Controller.get(Number(req.params.id))
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const getLast = (req: Request, res: Response, next: NextFunction) => {
  Controller.lastInvoice(
    Number(req.query.pvId),
    Boolean(req.query.fiscal),
    Number(req.query.tipo),
    Boolean(req.query.entorno),
  )
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const newInvoice = (req: Request, res: Response, next: NextFunction) => {
  Controller.newInvoice(
    req.body.pvData,
    req.body.newFact,
    req.body.dataFiscal,
    req.body.productsList,
    req.body.fileName,
    req.body.filePath,
    req.body.variosPagos,
    next,
    req.body.parcial,
    req.body.originalDetFact,
    req.body.items,
  )
    .then((dataFact) => {
      if (req.body.htmlOnly && req.body.invoiceHtml) {
        enqueueInvoicePdf({
          html: req.body.invoiceHtml,
          filePath: dataFact.filePath,
          fileName: dataFact.fileName,
          email: {
            factura: req.body.newFact,
            formaPago: req.body.formapagoStr,
          },
        });

        success({
          req,
          res,
          status: 200,
          message: {
            html: req.body.invoiceHtml,
            fileName: dataFact.fileName,
            filePath: dataFact.filePath,
            pdfUrl: `/static/invoices/${encodeURIComponent(dataFact.fileName)}`,
            pdfStatus: 'pending',
            resultInsert: dataFact.resultInsert,
          },
        });
      } else {
        file(
          req,
          res,
          dataFact.filePath,
          'application/pdf',
          dataFact.fileName,
          dataFact,
        );
      }
    })
    .catch(next);
};

const newOrder = (req: Request, res: Response, next: NextFunction) => {
  try {
    const dataFact = {
      fileName: req.body.fileName,
      filePath: req.body.filePath,
      resultInsert: req.body.orderId,
    };
    file(
      req,
      res,
      dataFact.filePath,
      'application/pdf',
      dataFact.fileName,
      dataFact,
    );
  } catch (error) {
    next(error);
  }
};

const forceNonFiscalOrder = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.body.dataFact) {
    return next(new Error('Faltan datos para generar la orden de pedido'));
  }

  req.body.fiscal = 0;
  req.body.dataFact.fiscal = false;
  req.body.dataFact.t_fact = 0;
  req.body.dataFact.enviar_email = false;
  next();
};

const getDataFactPDF = (req: Request, res: Response, next: NextFunction) => {
  if (req.query.sendEmail) {
    success({ req, res });
  } else {
    Controller.getDataFact(req.body.fileName, req.body.filePath)
      .then((dataFact) => {
        file(
          req,
          res,
          dataFact.filePath,
          'application/pdf',
          dataFact.fileName,
          dataFact,
        );
      })
      .catch(next);
  }
};

const cachedInvoicePDF = (req: Request, res: Response, next: NextFunction) => {
  if (req.query.sendEmail || req.query.noPrice) {
    return next();
  }

  Controller.get(Number(req.params.id))
    .then((data) => {
      if (!data || !data[0]) {
        return next();
      }

      const factura = data[0];
      const fileName = `${factura.letra} ${zfill(factura.pv, 5)}-${zfill(
        factura.cbte,
        8,
      )}.pdf`;
      const filePath = path.join('public', 'invoices', fileName);

      if (!fs.existsSync(filePath)) {
        return next();
      }

      const ageMs = Date.now() - fs.statSync(filePath).mtimeMs;
      const maxAgeMs = 48 * 60 * 60 * 1000;
      if (ageMs > maxAgeMs) {
        return next();
      }

      file(req, res, filePath, 'application/pdf', fileName, {
        fileName,
        filePath,
        cached: true,
      });
    })
    .catch(next);
};

const getFiscalDataInvoice = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  Controller.getFiscalDataInvoice(
    Number(req.query.ncbte),
    Number(req.query.pvId),
    Boolean(req.query.fiscal),
    Number(req.query.tipo),
    Boolean(req.query.entorno),
  )
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const cajaList = (req: Request, res: Response, next: NextFunction) => {
  Controller.cajaList(
    false,
    Number(req.query.userId),
    req.query.ptoVta ? Number(req.query.ptoVta) : undefined,
    String(req.query.desde),
    String(req.query.hasta),
    Number(req.params.page),
    Number(req.query.cantPerPage),
    req.query.tipo ? String(req.query.tipo) : undefined,
  )
    .then((lista: any) => {
      success({
        req,
        res,
        status: 200,
        message: lista,
      });
    })
    .catch(next);
};

const cajaListPDF = (req: Request, res: Response, next: NextFunction) => {
  Controller.cajaList(
    true,
    Number(req.query.userId),
    Number(req.query.ptoVta),
    String(req.query.desde),
    String(req.query.hasta),
    undefined,
    undefined,
    req.query.tipo ? String(req.query.tipo) : undefined,
  )
    .then((dataFact) => {
      file(
        req,
        res,
        dataFact.filePath,
        'application/pdf',
        dataFact.fileName,
        dataFact,
      );
    })
    .catch(next);
};

const cajaListExcel = (req: Request, res: Response, next: NextFunction) => {
  Controller.cajaList(
    false,
    Number(req.query.userId),
    Number(req.query.ptoVta),
    String(req.query.desde),
    String(req.query.hasta),
    undefined,
    undefined,
    req.query.tipo ? String(req.query.tipo) : undefined,
    true,
  )
    .then((dataFact) => {
      file(
        req,
        res,
        dataFact.filePath,
        'application/pdf',
        dataFact.fileName,
        dataFact,
      );
    })
    .catch(next);
};

const changePayType = (req: Request, res: Response, next: NextFunction) => {
  Controller.changePayType(Number(req.params.id), req.body.idType)
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const getDummy = (req: Request, res: Response, next: NextFunction) => {
  Controller.dummyServers(
    String(req.query.certFile),
    String(req.query.keyFile),
    Number(req.query.cuit),
  )
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const timeoutProuf = (req: Request, res: Response, next: NextFunction) => {
  setTimeout(() => {
    success({ req, res, message: 'ok' });
  }, 5000);
};

const correctorNC = (req: Request, res: Response, next: NextFunction) => {
  Controller.correctorNC()
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const detFact = (req: Request, res: Response, next: NextFunction) => {
  Controller.getDetFact(Number(req.params.id))
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const generarCodDescuento = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  Controller.codigoVerificacionDescuento(
    req.body.total,
    req.body.descuentoPorcentaje,
    req.body.descuento,
    req.body.cliente,
  )
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const verificaCodigoDescuento = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  Controller.verificaCodigo(req.body.codigo)
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const putVariosPagos = (req: Request, res: Response, next: NextFunction) => {
  Controller.putVariosPagos(req.body.variosPagos, Number(req.params.idFact))
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const resetTokenAfip = (req: Request, res: Response, next: NextFunction) => {
  Controller.resetTokenAfip()
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const getCategoriasPago = (req: Request, res: Response, next: NextFunction) => {
  Controller.getCategoriasPago()
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const newCategoreiaPago = (req: Request, res: Response, next: NextFunction) => {
  Controller.newCategoreiaPago(req.body.categoria)
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const refacturarIva = (req: Request, res: Response, next: NextFunction) => {
  const confirm = req.body.confirm === true || req.body.confirm === 'true';
  const ids = Array.isArray(req.body.ids)
    ? req.body.ids.map((id: string | number) => Number(id))
    : [];

  Controller.refacturarIvaBatch(
    ids,
    req.body.fecha,
    req.body.user,
    confirm,
  )
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const repararRefacturacionIva = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const confirm = req.body.confirm === true || req.body.confirm === 'true';

  Controller.repararRefacturacionIva(
    Number(req.body.originalId),
    Number(req.body.ncErroneaId),
    Number(req.body.facturaNuevaId),
    req.body.fecha,
    req.body.user,
    confirm,
  )
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

router
  .get('/details/:id', secure(EPermissions.ventas), get)
  .get('/cajaList/:page', secure(EPermissions.ventas), cajaList)
  .get('/cajaListPDF', secure(EPermissions.ventas), cajaListPDF)
  .get('/cajaListExcel', secure(EPermissions.ventas), cajaListExcel)
  .get(
    '/factDataPDF/:id',
    secure(EPermissions.ventas),
    cachedInvoicePDF,
    dataFactMiddle(),
    invoicePDFMiddle(),
    sendFactMiddle(),
    getDataFactPDF,
  )
  .get('/last', secure(EPermissions.ventas), getLast)
  .get('/detFact/:id', secure(EPermissions.ventas), detFact)
  .get('/dummy', secure(EPermissions.ventas), getDummy)
  .get('/timeout', secure(EPermissions.ventas), timeoutProuf)
  .get('/categoriasPago', secure(EPermissions.ventas), getCategoriasPago)
  .get('/afipData', secure(EPermissions.ventas), getFiscalDataInvoice)
  .get('/:page', secure(EPermissions.ventas), list)
  .post('/codigoDescuento', secure(EPermissions.ventas), generarCodDescuento)
  .post('/verificaCodigo', secure(EPermissions.ventas), verificaCodigoDescuento)
  .post('/refacturarIva', secure(EPermissions.ventas), refacturarIva)
  .post(
    '/repararRefacturacionIva',
    secure(EPermissions.ventas),
    repararRefacturacionIva,
  )
  .post(
    '/notaCred',
    secure(EPermissions.ventas),
    devFactMiddle(),
    fiscalMiddle(),
    invoicePDFMiddle(),
    sendFactMiddle(),
    newInvoice,
  )
  .post(
    '/notaCredPart',
    secure(EPermissions.ventas),
    factuMiddelDevPart(),
    fiscalMiddle(),
    invoicePDFMiddle(),
    sendFactMiddle(),
    newInvoice,
  )
  .post(
    '/orderPDF',
    secure(EPermissions.ventas),
    forceNonFiscalOrder,
    factuMiddel(),
    fiscalMiddle(),
    invoicePDFMiddle(),
    sendFactMiddle(),
    newOrder,
  )
  .post(
    '/',
    secure(EPermissions.ventas),
    factuMiddel(),
    fiscalMiddle(),
    invoiceHTMLMiddle(),
    newInvoice,
  )
  .post('/categoriasPago', secure(EPermissions.ventas), newCategoreiaPago)
  .delete('/:id', secure(EPermissions.ventas), remove)
  .put('/paytype/:id', secure(EPermissions.ventas), changePayType)
  .put('/variosPagos/:idFact', secure(EPermissions.ventas), putVariosPagos)
  .put('/resetTokenAfip', secure(EPermissions.ventas), resetTokenAfip);

export = router;
