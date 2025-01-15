import { IWhereParams } from '../../interfaces/Ifunctions';
import { EModeWhere, EConcatWhere } from '../../enums/EfunctMysql';
import { Tables, Columns } from '../../enums/EtablesDB';
import { NextFunction, Request, Response } from 'express';
import { INewPV } from 'interfaces/Irequests';
import { IFactura, IFormasPago, IProveedor, IUser } from 'interfaces/Itables';
import ptosVtaController from '../../api/components/ptosVta';
import proveedoresController from '../../api/components/proveedores';
import errorSend from '../error';
import store from '../../store/mysql';

const OPMiddle = () => {
  const middleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const filters: Array<IWhereParams> = [
        {
          mode: EModeWhere.strict,
          concat: EConcatWhere.none,
          items: [{ column: Columns.facturas.t_fact, object: String(-2) }],
        },
      ];

      const detalle: string = req.body.detalle;
      const importe: number = req.body.importe;
      const provedorID: number = req.body.provedorID;
      const user: IUser = req.body.user;
      const pvId = req.body.pvId;
      const pvData: Array<INewPV> = await ptosVtaController.get(pvId);
      const tFact: number = -2;
      const letra = 'OP';
      let pagos: IFormasPago[] = req.body.pagos;
      if (pagos && pagos.length > 0) {
        pagos = pagos.map((item) => {
          return {
            ...item,
            importe: -item.importe,
          };
        });
      }

      const getHighterNum: Array<{ last: number }> = await store.list(
        Tables.FACTURAS,
        [`MAX(${Columns.facturas.cbte}) as last`],
        filters,
      );
      const lastNumber = getHighterNum[0].last;
      let cbte = 0;
      if (lastNumber > 0) {
        cbte = lastNumber;
      }

      const proveedorData: Array<IProveedor> = await proveedoresController.get(
        provedorID,
      );

      const newFact: IFactura = {
        fecha: new Date(),
        pv: pvData[0].pv,
        cbte: cbte + 1,
        letra: letra,
        t_fact: tFact,
        cuit_origen: pvData[0].cuit,
        iibb_origen: pvData[0].iibb,
        ini_act_origen: pvData[0].ini_act,
        direccion_origen: pvData[0].direccion,
        raz_soc_origen: pvData[0].raz_soc,
        cond_iva_origen: pvData[0].cond_iva,
        tipo_doc_cliente: Number(proveedorData[0].cuit) === 0 ? 80 : 96,
        n_doc_cliente: Number(proveedorData[0].ndoc),
        cond_iva_cliente: Number(proveedorData[0].cond_iva),
        email_cliente: proveedorData[0].email,
        nota_cred: false,
        fiscal: false,
        raz_soc_cliente: proveedorData[0].razsoc,
        user_id: user.id || 0,
        seller_name: `${user.nombre} ${user.apellido}`,
        total_fact: -Math.round(importe * 100) / 100,
        total_iva: 0,
        total_neto: -Math.round(importe * 100) / 100,
        total_compra: 0,
        forma_pago: 5,
        pv_id: pvId,
        id_fact_asoc: 0,
        descuento: 0,
        det_rbo: detalle,
        direccion_entrega: '',
        telefono: proveedorData[0].telefono || '',
        localidad: '',
        provincia: '',
      };

      req.body.newFact = newFact;
      req.body.pvData = pvData[0];
      req.body.proveedorData = proveedorData[0];
      req.body.pagos = pagos;
      next();
    } catch (error) {
      console.error(error);
      next(errorSend('Faltan datos o hay datos erroneos, controlelo!'));
    }
  };
  return middleware;
};

export = OPMiddle;
