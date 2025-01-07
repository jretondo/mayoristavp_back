import { Router, NextFunction, Response, Request } from 'express';
import { success } from '../../../network/response';
const router = Router();
import Controller from './index';
import secure from '../../../auth/secure';
import { EPermissions } from '../../../enums/EfunctMysql';
import uploadFile from '../../../utils/multer';
import { staticFolders } from '../../../enums/EStaticFiles';

const list = (req: Request, res: Response, next: NextFunction) => {
  Controller.list(Number(req.params.page))
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

const publicList = (req: Request, res: Response, next: NextFunction) => {
  Controller.publicList()
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

const toggleEnabled = (req: Request, res: Response, next: NextFunction) => {
  Controller.toggleEnabled(req.body.id, req.body.enabled)
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
router.get('/public', publicList);
router.get('/:page', secure(EPermissions.userAdmin), list);
router.get('/details/:id', secure(EPermissions.userAdmin), get);
router.post(
  '/',
  secure(EPermissions.userAdmin),
  uploadFile(staticFolders.heroSlider, ['hero']),
  upsert,
);
router.put('/', secure(EPermissions.userAdmin), upsert);
router.put('/enabled', secure(EPermissions.userAdmin), toggleEnabled);
router.delete('/:id', secure(EPermissions.userAdmin), remove);

export = router;
