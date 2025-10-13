import { sendFactMiddle } from './../../../utils/facturacion/middleSendFact';
import { paymentPDFMiddle } from './../../../utils/facturacion/middlePDFPayment';
import { Router, NextFunction, Response, Request } from 'express';
import { file, success } from '../../../network/response';
const router = Router();
import Controller from './index';
import secure from '../../../auth/secure';
import { EPermissions } from '../../../enums/EfunctMysql';
import paymentMiddle from '../../../utils/facturacion/middleRecibo';
import dataPaymentMiddle from '../../../utils/facturacion/middleDataPayment';

const list = (req: Request, res: Response, next: NextFunction) => {
  Controller.list(
    undefined,
    req.query.search ? String(req.query.search) : undefined,
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

const listPagination = (req: Request, res: Response, next: NextFunction) => {
  throw new Error('Error de prueba');
  Controller.list(
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

const upsert = (req: Request, res: Response, next: NextFunction) => {
  Controller.upsert(req.body, next)
    .then((response) => {
      if (response) {
        success({
          message: response,
          req,
          res,
        });
      } else {
        next(response);
      }
    })
    .catch(next);
};

const remove = (req: Request, res: Response, next: NextFunction) => {
  Controller.remove(Number(req.params.id))
    .then((status) => {
      success({ req, res, status: status });
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

const dataFiscalPadron = (req: Request, res: Response, next: NextFunction) => {
  Controller.dataFiscalPadron(
    Number(req.query.cuit),
    String(req.query.cert),
    String(req.query.key),
    Number(req.query.cuitPv),
  )
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const listCtaCteClient = (req: Request, res: Response, next: NextFunction) => {
  Controller.listCtaCteClient(
    Number(req.query.idCliente),
    Boolean(req.query.debit),
    Boolean(req.query.credit),
    Number(req.params.page),
  )
    .then((lista) => {
      success({
        req,
        res,
        status: 200,
        message: lista,
      });
    })
    .catch(next);
};

const listCtaCte = (req: Request, res: Response, next: NextFunction) => {
  Controller.listCtaCte(
    Boolean(req.query.debit),
    Boolean(req.query.credit),
    String(req.query.desde),
    String(req.query.hasta),
    req.query.cliente ? String(req.query.cliente) : undefined,
    Number(req.params.page),
  )
    .then((lista) => {
      success({
        req,
        res,
        status: 200,
        message: lista,
      });
    })
    .catch(next);
};

const listCtaCteExcel = (req: Request, res: Response, next: NextFunction) => {
  Controller.listCtaCte(
    Boolean(req.query.debit),
    Boolean(req.query.credit),
    String(req.query.desde),
    String(req.query.hasta),
    req.query.cliente ? String(req.query.cliente) : undefined,
    undefined,
    undefined,
    undefined,
    true,
  )
    .then((dataFact: any) => {
      file(
        req,
        res,
        dataFact.filePath,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dataFact.fileName,
        dataFact,
      );
    })
    .catch(next);
};

const listCtaCtePDF = (req: Request, res: Response, next: NextFunction) => {
  Controller.listCtaCte(
    Boolean(req.query.debit),
    Boolean(req.query.credit),
    String(req.query.desde),
    String(req.query.hasta),
    req.query.cliente ? String(req.query.cliente) : undefined,
    undefined,
    undefined,
    true,
  )
    .then((dataFact: any) => {
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

const newPayment = (req: Request, res: Response, next: NextFunction) => {
  Controller.registerPayment(
    req.body.newFact,
    req.body.fileName,
    req.body.filePath,
    req.body.clienteData,
    req.body.pagos,
    next,
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

const getDataPaymentPDF = (req: Request, res: Response, next: NextFunction) => {
  if (req.query.sendEmail) {
    success({ req, res });
  } else {
    Controller.getDataPayment(req.body.fileName, req.body.filePath)
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

const deletePayment = (req: Request, res: Response, next: NextFunction) => {
  Controller.deletePayment(Number(req.body.id))
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

router
  .get('/dataFiscal', secure(EPermissions.clientes), dataFiscalPadron)
  .get('/ctaCte/all/excel', secure(EPermissions.clientes), listCtaCteExcel)
  .get('/ctaCte/all/pdf', secure(EPermissions.clientes), listCtaCtePDF)
  .get('/ctaCte/all/:page', secure(EPermissions.clientes), listCtaCte)
  .get('/ctaCte/:page', secure(EPermissions.clientes), listCtaCteClient)
  .get('/details/:id', secure(EPermissions.clientes), get)
  .get(
    '/payments/:id',
    secure(EPermissions.ventas),
    dataPaymentMiddle(),
    paymentPDFMiddle(),
    sendFactMiddle(),
    getDataPaymentPDF,
  )
  .get('/:page', secure(EPermissions.clientes), listPagination)
  .delete('/:id', secure(EPermissions.clientes), remove)
  .post('/payments/delete', secure(EPermissions.clientes), deletePayment)
  .get('/', secure(EPermissions.clientes), list)
  .post(
    '/payments',
    secure(EPermissions.clientes),
    secure(EPermissions.ventas),
    paymentMiddle(),
    paymentPDFMiddle(),
    sendFactMiddle(),
    newPayment,
  )
  .post('/', secure(EPermissions.clientes), upsert)
  .put('/', secure(EPermissions.clientes), upsert);

export = router;
