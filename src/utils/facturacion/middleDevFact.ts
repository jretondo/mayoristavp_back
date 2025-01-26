import { NextFunction, Request, Response } from 'express';
import { INewPV } from 'interfaces/Irequests';
import { IDetFactura, IFactura, IFormasPago, IUser } from 'interfaces/Itables';
import moment from 'moment';
import ControllerInvoices from '../../api/components/invoices';
import ControllerPtoVta from '../../api/components/ptosVta';
import { Conceptos, perIvaAlicuotas } from './AfipClass';
import { roundNumber } from '../roundNumb';

const devFactMiddle = () => {
  const middleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    req.body.timer = Number(new Date());
    const idFact = req.body.id;
    const fecha = req.body.fecha;
    let dataFact: Array<IFactura> = await ControllerInvoices.get(idFact);
    let detFact: Array<IDetFactura> = await ControllerInvoices.getDetails(
      idFact,
    );
    const user: IUser = req.body.user;
    const pvData: Array<INewPV> = await ControllerPtoVta.get(dataFact[0].pv_id);
    const esFiscal = dataFact[0].fiscal;
    const tipoFact = dataFact[0].t_fact;

    let pagos: Array<IFormasPago> = await ControllerInvoices.getFormasPago(
      idFact,
    );

    const parcial = req.body.parcial;
    if (parcial) {
      const items: Array<IItemsDevolucion> = req.body.items.filter(
        (item: IItemsDevolucion) => item.cant_prod > 0,
      );
      const productsList = await calcProdLista(items);
      req.body.originalDetFact = detFact;
      detFact = productsList.listaProd;

      dataFact[0].total_fact = productsList.totalFact;
      dataFact[0].total_iva = productsList.totalIva;
      dataFact[0].total_neto = productsList.totalNeto;
      dataFact[0].total_compra = productsList.totalCosto;

      pagos = req.body.variosPagos;

      if (pagos && pagos.length > 0) {
        let totalPagos = 0;
        pagos.forEach((prod) => {
          totalPagos += roundNumber(prod.importe);
        });
        if (totalPagos.toFixed(2) !== productsList.totalFact.toFixed(2)) {
          console.log('totalPagos', totalPagos.toFixed(2));
          console.log('totalFact', productsList.totalFact.toFixed(2));
          throw new Error('La suma de los pagos no coincide con el total');
        }
      }
    }

    if (pagos && pagos.length > 0) {
      pagos = pagos.map((item) => {
        return {
          ...item,
          importe: -item.importe,
        };
      });
    }

    let tipoNC: number = 0;
    let letra: string = 'DEV';
    if (esFiscal) {
      switch (tipoFact) {
        case 1:
          tipoNC = 3;
          letra = 'NC A';
          break;
        case 6:
          tipoNC = 8;
          letra = 'NC B';
          break;
        case 11:
          tipoNC = 13;
          letra = 'NC C';
          break;
        case 51:
          tipoNC = 53;
          letra = 'NC M';
          break;
        default:
          tipoNC = 0;
          letra = 'DEV';
          break;
      }
    }

    const newFact: IFactura = {
      fecha: fecha,
      pv: dataFact[0].pv,
      cbte: 0,
      letra: letra,
      t_fact: tipoNC,
      cuit_origen: dataFact[0].cuit_origen,
      iibb_origen: dataFact[0].iibb_origen,
      ini_act_origen: dataFact[0].ini_act_origen,
      direccion_origen: dataFact[0].direccion_origen,
      raz_soc_origen: dataFact[0].raz_soc_origen,
      cond_iva_origen: dataFact[0].cond_iva_origen,
      tipo_doc_cliente: dataFact[0].tipo_doc_cliente || 99,
      n_doc_cliente: dataFact[0].n_doc_cliente || 0,
      cond_iva_cliente: dataFact[0].cond_iva_cliente,
      email_cliente: dataFact[0].email_cliente || '',
      nota_cred: true,
      fiscal: esFiscal,
      raz_soc_cliente: dataFact[0].raz_soc_cliente || '',
      user_id: user.id || 0,
      seller_name: `${user.nombre} ${user.apellido}`,
      total_fact: -dataFact[0].total_fact,
      total_iva: -dataFact[0].total_iva,
      total_neto: -dataFact[0].total_neto,
      total_compra: -dataFact[0].total_compra,
      forma_pago: dataFact[0].forma_pago,
      pv_id: dataFact[0].pv_id,
      id_fact_asoc: dataFact[0].id || 0,
      descuento: dataFact[0].descuento,
      direccion_entrega: dataFact[0].direccion_entrega || '',
      telefono: dataFact[0].telefono || '',
      localidad: dataFact[0].localidad || '',
      provincia: dataFact[0].provincia || '',
      cat_pago: '',
    };
    let newDet: Array<IDetFactura> = [];

    new Promise((resolve, reject) => {
      detFact.map((item, key) => {
        const precio_ind = -item.precio_ind;
        const total_costo = -item.total_costo;
        const total_iva = -item.total_iva;
        const total_neto = -item.total_neto;
        const total_prod = -item.total_prod;
        newDet.push({
          ...item,
          precio_ind,
          total_costo,
          total_iva,
          total_neto,
          total_prod,
        });
        if (detFact.length - 1 === key) {
          resolve(detFact);
        }
      });
    });

    let ivaList: Array<IIvaItem> = [];
    let dataFiscal:
      | FactInscriptoProd
      | FactInscriptoServ
      | FactMonotribProd
      | FactMonotribServ
      | any = {};

    if (esFiscal) {
      const descuentoPer =
        (dataFact[0].descuento /
          (dataFact[0].total_fact + dataFact[0].descuento)) *
        100;

      ivaList = await listaIva(detFact, descuentoPer);
      dataFiscal = {
        CantReg: 1,
        PtoVta: dataFact[0].pv,
        CbteTipo: newFact.t_fact,
        DocTipo: newFact.tipo_doc_cliente,
        DocNro: newFact.n_doc_cliente,
        CbteFch: moment(newFact.fecha, 'YYYY-MM-DD').format('YYYYMMDD'),
        ImpTotal: -newFact.total_fact,
        MonCotiz: 1,
        MonId: 'PES',
        Concepto: Conceptos.Productos,
        ImpTotConc: 0,
        ImpNeto: -newFact.total_neto,
        ImpOpEx: 0,
        ImpIVA: -newFact.total_iva,
        ImpTrib: 0,
        Iva: dataFact[0].cond_iva_origen === 1 ? ivaList : null,
        CbtesAsoc: [
          {
            Tipo: dataFact[0].t_fact,
            PtoVta: dataFact[0].pv,
            Nro: dataFact[0].cbte,
            Cuit: dataFact[0].n_doc_cliente,
          },
        ],
      };
    }
    req.body.newFact = newFact;
    req.body.dataFiscal = dataFiscal;
    req.body.pvData = pvData[0];
    req.body.productsList = newDet;
    req.body.variosPagos = pagos;

    next();
  };
  return middleware;
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
        let ivaAux = perIvaAlicuotas.find(
          (e) => e.per === item.alicuota_id,
        ) || { per: 0, id: 3 };
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
        ivaAnt = 5;
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

const calcProdLista = (
  productsList: IItemsDevolucion[],
): Promise<IfactCalc> => {
  let dataAnt: IDetFactura[] = [];
  let idAnt: number = 0;
  productsList.sort((a, b) => {
    return a.id - b.id;
  });
  return new Promise((resolve, reject) => {
    let factura: IfactCalc = {
      listaProd: [],
      totalFact: 0,
      totalIva: 0,
      totalNeto: 0,
      totalCosto: 0,
    };
    productsList.map(async (prod, key) => {
      let dataProd: IDetFactura[] = [];
      if (prod.id === idAnt) {
        dataProd = dataAnt;
      } else {
        dataProd = await ControllerInvoices.getDetail(prod.id);
      }
      idAnt = prod.id;
      dataAnt = dataProd;
      const totalCantItem = dataProd[0].cant_prod;
      const costoUnit = roundNumber(dataProd[0].total_costo / totalCantItem);
      const netoUnit = roundNumber(dataProd[0].total_neto / totalCantItem);
      const ivaUnit = roundNumber(dataProd[0].total_iva / totalCantItem);
      const totalUnit = roundNumber(dataProd[0].total_prod / totalCantItem);

      const totalCosto = costoUnit * prod.cant_prod;

      const totalProd = totalUnit * prod.cant_prod;

      const totalNeto = netoUnit * prod.cant_prod;

      const totalIva = ivaUnit * prod.cant_prod;

      const newProdFact: IDetFactura = {
        nombre_prod: dataProd[0].nombre_prod,
        cant_prod: prod.cant_prod,
        unidad_tipo_prod: dataProd[0].unidad_tipo_prod,
        id_prod: dataProd[0].id_prod,
        total_prod: roundNumber(totalProd),
        total_iva: roundNumber(totalIva),
        alicuota_id: dataProd[0].alicuota_id,
        total_costo: roundNumber(totalCosto),
        total_neto: roundNumber(totalNeto),
        precio_ind: dataProd[0].precio_ind,
        descuento_porcentaje: dataProd[0].descuento_porcentaje || 0,
        cant_anulada: 0,
      };

      factura.listaProd.push(newProdFact);
      factura.totalFact = factura.totalFact + roundNumber(totalProd);
      factura.totalIva = factura.totalIva + roundNumber(totalIva);
      factura.totalNeto = factura.totalNeto + roundNumber(totalNeto);
      factura.totalCosto = factura.totalCosto + roundNumber(totalCosto);

      if (key === productsList.length - 1) {
        factura.totalIva = roundNumber(factura.totalIva);
        factura.totalNeto = roundNumber(factura.totalNeto);
        resolve(factura);
      }
    });
  });
};

interface IIvaItem {
  Id: AlicuotasIva;
  BaseImp: number;
  Importe: number;
}

interface IItemsDevolucion {
  id: number;
  cant_prod: number;
}

interface IfactCalc {
  listaProd: Array<IDetFactura>;
  totalFact: number;
  totalIva: number;
  totalNeto: number;
  totalCosto: number;
}

export = devFactMiddle;
