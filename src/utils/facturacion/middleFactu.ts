import { NextFunction, Request, Response } from 'express';
import { INewFactura, INewProduct, INewPV } from 'interfaces/Irequests';
import {
  IClientes,
  IDetFactura,
  IFactura,
  IFormasPago,
  IUser,
} from 'interfaces/Itables';
import ptosVtaController from '../../api/components/ptosVta';
import prodController from '../../api/components/products';
import {
  AlicuotasIva,
  Conceptos,
  DocTipos,
  FactInscriptoProd,
  FactInscriptoServ,
  FactMonotribProd,
  FactMonotribServ,
  perIvaAlicuotas,
} from './AfipClass';
import moment from 'moment';
import errorSend from '../error';
import { roundNumber } from '../../utils/roundNumb';
import clientesController from '../../api/components/clientes';
import usuariosController from '../../api/components/user';

const factuMiddel = () => {
  const middleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      req.body.timer = Number(new Date());
      const body: dataFact = req.body.dataFact;
      let user: IUser = req.body.user;
      const pvId = body.pv_id;
      const pvData: Array<INewPV> = await ptosVtaController.get(pvId);
      const condIvaOrigen = Number(pvData[0].cond_iva);
      const fiscalBool = req.body.fiscal;
      if (parseInt(fiscalBool) === 0) {
        body.fiscal = false;
      }
      const aplicaIva =
        Boolean(body.fiscal) &&
        condIvaOrigen === 1 &&
        [1, 6, 51].includes(Number(body.t_fact));
      const productsList: IfactCalc = await calcProdLista(
        body.lista_prod,
        aplicaIva,
      );
      const variosPagos = body.variosPagos;

      if (!body.cliente_bool) {
        delete body.cliente_id;
      }
      let letra = '';

      if (body.fiscal) {
        if (body.t_fact === 51) {
          letra = 'M';
        } else if (body.t_fact === 1) {
          letra = 'A';
        } else if (body.t_fact === 6) {
          letra = 'B';
        } else if (body.t_fact === 11) {
          letra = 'C';
        } else {
          letra = 'X';
        }
      } else {
        body.t_fact = 0;
        letra = 'X';
      }

      const descuento: number = body.descuentoPerc;
      let descuentoNumber: number = 0;
      let descuentoPer = 0;

      if (descuento > 100) {
        throw new Error('Descuento erroneo!');
      }

      if (descuento > 0) {
        descuentoNumber =
          Math.round(productsList.totalFact * (descuento / 100) * 100) / 100;
        descuentoPer = descuento;
        productsList.totalFact =
          productsList.totalFact - productsList.totalFact * (descuento / 100);
        productsList.totalIva =
          productsList.totalIva - productsList.totalIva * (descuento / 100);
        productsList.totalNeto =
          productsList.totalNeto - productsList.totalNeto * (descuento / 100);
      }

      if (variosPagos && body.variosPagos.length > 0) {
        let totalPagos = 0;
        body.variosPagos.forEach((prod) => {
          totalPagos += roundNumber(prod.importe);
        });
        if (totalPagos.toFixed(2) !== productsList.totalFact.toFixed(2)) {
          console.log('totalPagos', totalPagos.toFixed(2));
          console.log('totalFact', productsList.totalFact.toFixed(2));
          console.log('dataFact', body);
          throw new Error('La suma de los pagos no coincide con el total');
        }
      }

      let clienteData: IClientes[] = [];

      body.cliente_id &&
        body.cliente_id > 0 &&
        (clienteData = await clientesController.get(body.cliente_id));
      const tipoDocCliente =
        clienteData.length > 0
          ? getDocTipoCliente(clienteData[0].cuit)
          : DocTipos['Sin identificar'];
      const nroDocCliente =
        tipoDocCliente === DocTipos['Sin identificar']
          ? 0
          : Number(clienteData[0].ndoc);

      req.body.user_id &&
        (user = await usuariosController
          .getUser(req.body.user_id)
          .then((res) => res[0])
          .catch((err) => {
            throw new Error('Usuario no encontrado');
          }));

      if (
        body.cliente_id &&
        body.cliente_id > 0 &&
        body.variosPagos &&
        body.variosPagos.length > 0
      ) {
        if (body.variosPagos.some((pago) => pago.tipo === 4)) {
          throw new Error(
            'No se puede facturar con cuenta corriente y cliente seleccionado',
          );
        }
      } else if (
        !body.cliente_id &&
        body.variosPagos &&
        body.variosPagos.length > 0
      ) {
        if (body.variosPagos.some((pago) => pago.tipo === 4)) {
          throw new Error(
            'No se puede facturar con cuenta corriente y cliente seleccionado',
          );
        }
      }

      const newFact: IFactura = {
        fecha: body.fecha,
        pv: pvData[0].pv,
        cbte: 0,
        letra: letra,
        t_fact: body.t_fact,
        cuit_origen: pvData[0].cuit,
        iibb_origen: pvData[0].iibb,
        ini_act_origen: pvData[0].ini_act,
        direccion_origen: pvData[0].direccion,
        raz_soc_origen: pvData[0].raz_soc,
        cond_iva_origen: pvData[0].cond_iva,
        tipo_doc_cliente: tipoDocCliente,
        n_doc_cliente: nroDocCliente,
        cond_iva_cliente: body.cliente_id ? clienteData[0].cond_iva : 0,
        email_cliente: body.enviar_email ? body.cliente_email || '' : '',
        nota_cred: false,
        fiscal: body.fiscal,
        raz_soc_cliente: body.cliente_id ? clienteData[0].razsoc : '',
        user_id: user.id || 0,
        seller_name: `${user.nombre} ${user.apellido}`,
        total_fact: roundNumber(productsList.totalFact),
        total_iva: aplicaIva ? roundNumber(productsList.totalIva) : 0,
        total_neto:
          aplicaIva
            ? roundNumber(productsList.totalNeto)
            : roundNumber(productsList.totalFact),
        total_compra: roundNumber(productsList.totalCosto),
        forma_pago: body.forma_pago,
        pv_id: body.pv_id,
        id_fact_asoc: 0,
        descuento: descuentoNumber,
        direccion_entrega:
          (clienteData.length > 0 && clienteData[0].entrega) || '',
        telefono: (clienteData.length > 0 && clienteData[0].telefono) || '',
        localidad: (clienteData.length > 0 && clienteData[0].localidad) || '',
        provincia: (clienteData.length > 0 && clienteData[0].provincia) || '',
        cat_pago: '',
      };

      let ivaList: Array<IIvaItem> = [];
      let dataFiscal:
        | FactInscriptoProd
        | FactInscriptoServ
        | FactMonotribProd
        | FactMonotribServ
        | any = {};

      if (body.fiscal) {
        ivaList = await listaIva(productsList.listaProd, descuentoPer);
        dataFiscal = {
          CantReg: 1,
          PtoVta: pvData[0].pv,
          CbteTipo: body.t_fact,
          DocTipo: tipoDocCliente,
          DocNro: nroDocCliente,
          CbteFch: moment(body.fecha, 'YYYY-MM-DD').format('YYYYMMDD'),
          ImpTotal: roundNumber(productsList.totalFact),
          MonCotiz: 1,
          MonId: 'PES',
          Concepto: Conceptos.Productos,
          ImpTotConc: 0,
          ImpNeto:
            aplicaIva
              ? roundNumber(productsList.totalNeto)
              : roundNumber(productsList.totalFact),
          ImpOpEx: 0,
          ImpIVA: aplicaIva ? roundNumber(productsList.totalIva) : 0,
          ImpTrib: 0,
          ...(aplicaIva ? { Iva: ivaList } : {}),
        };
      }
      req.body.newFact = newFact;
      req.body.dataFiscal = dataFiscal;
      req.body.pvData = pvData[0];
      req.body.productsList = productsList.listaProd;
      req.body.variosPagos = variosPagos;
      next();
    } catch (error) {
      console.error(error);
      next(errorSend('Faltan datos o hay datos erroneos, controlelo!'));
    }
  };
  return middleware;
};

const calcProdLista = (
  productsList: INewFactura['lista_prod'],
  aplicaIva: boolean,
): Promise<IfactCalc> => {
  let dataAnt: Array<INewProduct> = [];
  let idAnt: number = 0;
  productsList.sort((a, b) => {
    return a.id_prod - b.id_prod;
  });
  return (async () => {
    const factura: IfactCalc = {
      listaProd: [],
      totalFact: 0,
      totalIva: 0,
      totalNeto: 0,
      totalCosto: 0,
    };

    for (const prod of productsList) {
      let dataProd: Array<INewProduct>;
      if (prod.id_prod === idAnt) {
        dataProd = dataAnt;
      } else {
        dataProd = (await prodController.getPrincipal(prod.id_prod)).productGral;
      }
      idAnt = prod.id_prod;
      dataAnt = dataProd;

      if (!dataProd[0]) {
        throw new Error(`Producto no encontrado: ${prod.id_prod}`);
      }

      const descuentoPorcentaje = Number(prod.descuento_porcentaje) || 0;
      const ivaAlicuota = aplicaIva ? Number(dataProd[0].iva) || 0 : 0;
      const alicuotaId = aplicaIva ? getAlicuotaId(ivaAlicuota) : 0;
      const totalCosto = dataProd[0].precio_compra * prod.cant_prod;
      const totalProd =
        dataProd[0].vta_price *
        prod.cant_prod *
        (1 - descuentoPorcentaje / 100);
      const totalNeto =
        aplicaIva && ivaAlicuota > 0
          ? totalProd / (1 + ivaAlicuota / 100)
          : totalProd;
      const totalIva = aplicaIva ? totalProd - totalNeto : 0;

      factura.listaProd.push({
        nombre_prod: dataProd[0].name,
        cant_prod: prod.cant_prod,
        unidad_tipo_prod: dataProd[0].unidad,
        id_prod: prod.id_prod,
        total_prod: roundNumber(totalProd),
        total_iva: roundNumber(totalIva),
        alicuota_id: alicuotaId,
        total_costo: roundNumber(totalCosto),
        total_neto: roundNumber(totalNeto),
        precio_ind: dataProd[0].vta_price,
        descuento_porcentaje: descuentoPorcentaje,
        cant_anulada: 0,
      });

      factura.totalFact += roundNumber(totalProd);
      factura.totalIva += roundNumber(totalIva);
      factura.totalNeto += roundNumber(totalNeto);
      factura.totalCosto += roundNumber(totalCosto);
    }

    factura.totalFact = roundNumber(factura.totalFact);
    factura.totalIva = roundNumber(factura.totalIva);
    factura.totalNeto = roundNumber(factura.totalNeto);
    factura.totalCosto = roundNumber(factura.totalCosto);
    return factura;
  })();
};

const listaIva = async (
  listaProd: Array<IDetFactura>,
  descuento: number,
): Promise<Array<IIvaItem>> => {
  listaProd.sort((a, b) => {
    return a.alicuota_id - b.alicuota_id;
  });
  let ivaAnt = 0;
  let listaIva: Array<IIvaItem> = [];
  if (listaProd.length > 0) {
    return new Promise((resolve, reject) => {
      listaProd.map((item, key) => {
        let ivaAux = perIvaAlicuotas.find((e) => e.id === item.alicuota_id) || {
          per: 0,
          id: 3,
        };
        const iva = ivaAux.id;
        if (iva !== ivaAnt) {
          if (descuento > 0) {
            listaIva.push({
              Id: iva,
              BaseImp: item.total_neto - item.total_neto * (descuento / 100),
              Importe: item.total_iva - item.total_iva * (descuento / 100),
            });
          } else {
            listaIva.push({
              Id: iva,
              BaseImp: item.total_neto,
              Importe: item.total_iva,
            });
          }
        } else {
          const index = listaIva.length - 1;
          if (descuento > 0) {
            listaIva[index] = {
              Id: iva,
              BaseImp:
                listaIva[index].BaseImp +
                (item.total_neto - item.total_neto * (descuento / 100)),
              Importe:
                listaIva[index].Importe +
                (item.total_iva - item.total_iva * (descuento / 100)),
            };
          } else {
            listaIva[index] = {
              Id: iva,
              BaseImp: listaIva[index].BaseImp + item.total_neto,
              Importe: listaIva[index].Importe + item.total_iva,
            };
          }
        }
        ivaAnt = iva;
        if (key === listaProd.length - 1) {
          const newList: Array<IIvaItem> = [];
          listaIva.map((item, key2) => {
            newList.push({
              Id: item.Id,
              BaseImp: Math.round(item.BaseImp * 100) / 100,
              Importe: Math.round(item.Importe * 100) / 100,
            });
            if (key2 === listaIva.length - 1) {
              resolve(newList);
            }
          });
        }
      });
    });
  } else {
    return listaIva;
  }
};

const getAlicuotaId = (ivaAlicuota: number): number => {
  const alicuota = perIvaAlicuotas.find(
    (item) => Number(item.per) === Number(ivaAlicuota),
  );

  if (!alicuota) {
    throw new Error(`Alicuota de IVA no valida: ${ivaAlicuota}`);
  }

  return alicuota.id;
};

const getDocTipoCliente = (tipoDoc: number | boolean): DocTipos => {
  const tipo = Number(tipoDoc);

  if (tipo === 0) {
    return DocTipos['CUIT'];
  }

  if (tipo === 1) {
    return DocTipos['DNI'];
  }

  return DocTipos['Sin identificar'];
};

interface IfactCalc {
  listaProd: Array<IDetFactura>;
  totalFact: number;
  totalIva: number;
  totalNeto: number;
  totalCosto: number;
}
interface IIvaItem {
  Id: AlicuotasIva;
  BaseImp: number;
  Importe: number;
}
interface dataFact {
  fecha: Date;
  pv_id: number;
  fiscal: boolean;
  forma_pago: number;
  enviar_email: boolean;
  cliente_email: string;
  cliente_bool: boolean;
  lista_prod: INewFactura['lista_prod'];
  descuentoPerc: number;
  variosPagos: IFormasPago[];
  t_fact: number;
  cliente_id?: number;
}
export = factuMiddel;
