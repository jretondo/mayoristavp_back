import { Router, NextFunction, Response, Request } from 'express';
import { success } from '../../../network/response';
const router = Router();
import Controller from './index';
import secure from '../../../auth/secure';
import { EPermissions } from '../../../enums/EfunctMysql';

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
    Number(req.query.estado),
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

const get = (req: Request, res: Response, next: NextFunction) => {
  Controller.get(Number(req.params.id))
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const updateEstado = (req: Request, res: Response, next: NextFunction) => {
  Controller.updateEstado(Number(req.params.id), Number(req.body.estado))
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const updateNotas = (req: Request, res: Response, next: NextFunction) => {
  Controller.updateNotas(Number(req.params.id), String(req.body.notas))
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

router.get('/', secure(EPermissions.proveedores), list);
router.get('/:page', secure(EPermissions.proveedores), listPagination);
router.get('/details/:id', secure(EPermissions.proveedores), get);
router.put('/estado/:id', secure(EPermissions.proveedores), updateEstado);
router.put('/notas/:id', secure(EPermissions.proveedores), updateNotas);

export = router;
