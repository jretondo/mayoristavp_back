import { NextFunction, Request, Response } from 'express';
import { INewPV } from 'interfaces/Irequests';
import { IDetFactura, IFactura } from 'interfaces/Itables';
import errorSend from '../error';
import ControllerInvoices from '../../api/components/invoices';
import ControllerPtoVta from '../../api/components/ptosVta';

const dataPaymentMiddle = () => {
  const middleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const idFact = Number(req.params.id);
      const dataFact: Array<IFactura> = await ControllerInvoices.get(idFact);
      const pvData: Array<INewPV> = await ControllerPtoVta.get(
        dataFact[0].pv_id,
      );
      const pagos: Array<IDetFactura> = await ControllerInvoices.getFormasPago(
        idFact,
      );

      req.body.pvData = pvData[0];
      req.body.newFact = dataFact[0];
      req.body.pagos = pagos;

      next();
    } catch (error) {
      console.error(error);
      next(errorSend('Faltan datos o hay datos erroneos, controlelo!'));
    }
  };
  return middleware;
};

export = dataPaymentMiddle;
