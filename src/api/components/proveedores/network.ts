import { Router, NextFunction, Response, Request } from 'express';
import { file, success } from '../../../network/response';
const router = Router();
import Controller from './index';
import secure from '../../../auth/secure';
import { EPermissions } from '../../../enums/EfunctMysql';
import OPMiddle from '../../../utils/facturacion/middleOP';
import { paymentPDFMiddle } from '../../../utils/facturacion/middlePDFPayment';
import { sendFactMiddle } from '../../../utils/facturacion/middleSendFact';

const list = (req: Request, res: Response, next: NextFunction) => {
  Controller.list(undefined, req.body.query)
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
  Controller.upsert(req.body)
    .then((response) => {
      if (response) {
        success({
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

const newOP = (req: Request, res: Response, next: NextFunction) => {
  Controller.registerOP(
    req.body.newFact,
    req.body.fileName,
    req.body.filePath,
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

router.get('/', secure(EPermissions.proveedores), list);
router.get('/:page', secure(EPermissions.proveedores), listPagination);
router.get('/details/:id', secure(EPermissions.proveedores), get);
router.post(
  '/op',
  secure(EPermissions.proveedores),
  secure(EPermissions.ventas),
  OPMiddle(),
  paymentPDFMiddle(),
  sendFactMiddle(),
  newOP,
);
router.post('/', secure(EPermissions.proveedores), upsert);
router.put('/', secure(EPermissions.proveedores), upsert);
router.delete('/:id', secure(EPermissions.proveedores), remove);

export = router;
