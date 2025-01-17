import { Router, NextFunction, Response, Request } from 'express';
import { success } from '../../../network/response';
const router = Router();
import Controller from './index';
import secure from '../../../auth/secure';
import { EPermissions } from '../../../enums/EfunctMysql';

const get = (req: Request, res: Response, next: NextFunction) => {
  Controller.get(Number(req.params.id))
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

const post = (req: Request, res: Response, next: NextFunction) => {
  Controller.newOrder(req.body)
    .then((data) => {
      success({ req, res, message: data });
    })
    .catch(next);
};

router.get('/:id', secure(EPermissions.ventas), get);
router.post('/', post);

export = router;
