import { Iorder } from './../../../interfaces/Ifunctions';
import { ETypesJoin } from '../../../enums/EfunctMysql';
import { MetodosPago } from './../../../enums/EtablesDB';
import { IFormasPago, IMovCtaCte } from './../../../interfaces/Itables';
import { createListSellsPDF } from './../../../utils/facturacion/lists/createListSellsPDF';
import {
  EConcatWhere,
  EModeWhere,
  ESelectFunct,
} from '../../../enums/EfunctMysql';
import { Tables, Columns } from '../../../enums/EtablesDB';
import StoreType from '../../../store/mysql';
import getPages from '../../../utils/getPages';
import { AfipClass, CbteTipos } from '../../../utils/facturacion/AfipClass';
import ptosVtaController from '../ptosVta';
import { Ipages, IWhereParams, IJoin } from 'interfaces/Ifunctions';
import { IClientes, IDetFactura, IFactura, IUser } from 'interfaces/Itables';
import { INewPV } from 'interfaces/Irequests';
import ControllerStock from '../stock';
import fs from 'fs';
import { NextFunction } from 'express';
import controller from '../clientes';
import { sendCode } from '../../../utils/sendEmails/sendCode';
import moment from 'moment';
import { roundNumber } from '../../../utils/roundNumb';
import { staticFolders } from '../../../enums/EStaticFiles';
import path from 'path';

export = (injectedStore: typeof StoreType) => {
  let store = injectedStore;

  const list = async (
    pvId?: number,
    fiscal?: number,
    cbte?: number,
    page?: number,
    item?: string,
    cantPerPage?: number,
  ) => {
    let filter0: IWhereParams | undefined = undefined;
    let filter1: IWhereParams | undefined = undefined;
    let filter2: IWhereParams | undefined = undefined;
    let filters: Array<IWhereParams> = [];
    filter0 = {
      mode: EModeWhere.strict,
      concat: EConcatWhere.and,
      items: pvId
        ? [
            { column: Columns.facturas.pv_id, object: String(pvId) },
            { column: Columns.facturas.fiscal, object: String(fiscal) },
          ]
        : [{ column: Columns.facturas.fiscal, object: String(fiscal) }],
    };
    filters.push(filter0);
    if (item) {
      filter1 = {
        mode: EModeWhere.like,
        concat: EConcatWhere.or,
        items: [
          { column: Columns.facturas.cae, object: String(item) },
          { column: Columns.facturas.n_doc_cliente, object: String(item) },
          { column: Columns.facturas.fecha, object: String(item) },
          { column: Columns.facturas.raz_soc_cliente, object: String(item) },
        ],
      };
      filters.push(filter1);
    }

    if (cbte) {
      filter2 = {
        mode: EModeWhere.strict,
        concat: EConcatWhere.none,
        items: [{ column: Columns.facturas.cbte, object: String(cbte) }],
      };
      filters.push(filter2);
    }

    let pages: Ipages;
    let order: Iorder;
    if (page) {
      pages = {
        currentPage: page,
        cantPerPage: cantPerPage || 10,
        order: Columns.facturas.create_time,
        asc: false,
      };
      order = {
        asc: false,
        columns: [Columns.facturas.create_time],
      };
      const data = await store.list(
        Tables.FACTURAS,
        [ESelectFunct.all],
        filters,
        [`${Tables.FACTURAS}.${Columns.facturas.id}`],
        pages,
        undefined,
        { columns: [Columns.facturas.create_time], asc: false },
      );

      const dataDetails = await data.map(async (item: any) => {
        const details = await getDetFact(item.id, true);
        const pagos = await getFormasPago(item.id);
        return {
          ...item,
          details: await Promise.all(details),
          pagos: await Promise.all(pagos),
        };
      });
      const cant = await store.list(
        Tables.FACTURAS,
        [`COUNT(${ESelectFunct.all}) AS COUNT`],
        filters,
        undefined,
        undefined,
      );
      const pagesObj = await getPages(cant[0].COUNT, 10, Number(page));
      return {
        data: await Promise.all(dataDetails),
        pagesObj,
      };
    } else {
      const data = await store.list(
        Tables.FACTURAS,
        [ESelectFunct.all],
        filters,
        undefined,
        undefined,
      );
      return {
        data,
      };
    }
  };

  const cajaList = async (
    pdf: boolean,
    userId: number,
    ptoVtaId: number | undefined,
    desde: string,
    hasta: string,
    page?: number,
    cantPerPage?: number,
  ): Promise<any> => {
    let filters: Array<IWhereParams> = [
      {
        mode: EModeWhere.strict,
        concat: EConcatWhere.and,
        items: [
          { column: Columns.facturas.user_id, object: String(userId) },
          { column: Columns.facturas.pv_id, object: String(ptoVtaId) },
        ],
      },
    ];

    if (!userId && ptoVtaId) {
      filters = [
        {
          mode: EModeWhere.strict,
          concat: EConcatWhere.and,
          items: [{ column: Columns.facturas.pv_id, object: String(ptoVtaId) }],
        },
      ];
    }

    if (!userId && !ptoVtaId) {
      filters = [];
    }

    if (!ptoVtaId && userId) {
      filters = [
        {
          mode: EModeWhere.strict,
          concat: EConcatWhere.and,
          items: [{ column: Columns.facturas.user_id, object: String(userId) }],
        },
      ];
    }

    const filter1: IWhereParams = {
      mode: EModeWhere.higherEqual,
      concat: EConcatWhere.none,
      items: [{ column: Columns.facturas.fecha, object: String(desde) }],
    };

    const filter2: IWhereParams = {
      mode: EModeWhere.lessEqual,
      concat: EConcatWhere.none,
      items: [{ column: Columns.facturas.fecha, object: String(hasta) }],
    };

    filters.push(filter1, filter2);

    let pages: Ipages;

    const joinQuery: IJoin = {
      table: Tables.FORMAS_PAGO,
      colJoin: Columns.formasPago.id_fact,
      colOrigin: Columns.prodPrincipal.id,
      type: ETypesJoin.left,
    };

    if (page) {
      pages = {
        currentPage: page,
        cantPerPage: cantPerPage || 10,
        order: Columns.facturas.create_time,
        asc: true,
      };
      const totales = await store.list(
        Tables.FACTURAS,
        [
          `SUM(${Columns.facturas.total_fact}) AS SUMA`,
          Columns.facturas.forma_pago,
        ],
        filters,
        [Columns.facturas.forma_pago],
        undefined,
      );
      const totales2 = await store.list(
        Tables.FACTURAS,
        [`SUM(${Columns.formasPago.importe}) AS SUMA`, Columns.formasPago.tipo],
        filters,
        [Columns.formasPago.tipo],
        undefined,
        [joinQuery],
      );

      const data = await store.list(
        Tables.FACTURAS,
        [ESelectFunct.all],
        filters,
        [`${Tables.FACTURAS}.${Columns.facturas.id}`],
        pages,
        undefined,
        { columns: [Columns.facturas.create_time], asc: false },
      );

      const dataDetails = await data.map(async (item: any) => {
        const details = await getDetFact(item.id, true);
        const pagos = await getFormasPago(item.id);
        return {
          ...item,
          details: await Promise.all(details),
          pagos: await Promise.all(pagos),
        };
      });

      const cant = await store.list(
        Tables.FACTURAS,
        [`COUNT(${ESelectFunct.all}) AS COUNT`],
        filters,
        [`${Tables.FACTURAS}.${Columns.facturas.id}`],
        undefined,
        [joinQuery],
      );

      const pagesObj = await getPages(cant.length, 10, Number(page));
      return {
        data: await Promise.all(dataDetails),
        pagesObj,
        totales,
        totales2,
      };
    } else {
      const totales = await store.list(
        Tables.FACTURAS,
        [
          `SUM(${Columns.facturas.total_fact}) AS SUMA`,
          Columns.facturas.forma_pago,
        ],
        filters,
        [Columns.facturas.forma_pago],
        undefined,
        [joinQuery],
      );
      const totales2 = await store.list(
        Tables.FACTURAS,
        [`SUM(${Columns.formasPago.importe}) AS SUMA`, Columns.formasPago.tipo],
        filters,
        [Columns.formasPago.tipo],
        undefined,
        [joinQuery],
      );
      const data = await store.list(
        Tables.FACTURAS,
        [ESelectFunct.all],
        filters,
        undefined,
        undefined,
        undefined,
        { columns: [Columns.facturas.create_time], asc: false },
      );

      if (pdf) {
        const cajaList: any = await createListSellsPDF(
          userId,
          ptoVtaId || 0,
          desde,
          hasta,
          totales,
          totales2,
          data,
        );
        try {
          setTimeout(() => {
            fs.unlinkSync(cajaList.filePath);
          }, 2500);
        } catch (error) {}
        return cajaList;
      } else {
        return {
          data,
          totales,
        };
      }
    }
  };

  const get = async (id: number) => {
    return await store.get(Tables.FACTURAS, id);
  };

  const getDetail = async (id: number) => {
    return await store.get(Tables.DET_FACTURAS, id);
  };

  const remove = async (id: number) => {
    return await store.remove(Tables.FACTURAS, { id });
  };

  const insertFact = async (
    pvId: number,
    newFact: IFactura,
    newDetFact: Array<IDetFactura>,
    factFiscal:
      | FactInscriptoProd
      | FactInscriptoProdNC
      | FactInscriptoServ
      | FactInscriptoServNC
      | FactMonotribProd
      | FactMonotribProdNC
      | FactMonotribServ
      | FactMonotribServNC,
  ): Promise<any> => {
    if (newFact.fiscal) {
      newFact.cae = factFiscal.CAE;
      newFact.vto_cae = new Date(factFiscal.CAEFchVto || '') || new Date();
    }

    const result = await store.insert(Tables.FACTURAS, newFact);
    if (result.affectedRows > 0) {
      const factId = result.insertId;

      const headers: Array<string> = [
        Columns.detallesFact.fact_id,
        Columns.detallesFact.id_prod,
        Columns.detallesFact.nombre_prod,
        Columns.detallesFact.cant_prod,
        Columns.detallesFact.unidad_tipo_prod,
        Columns.detallesFact.total_prod,
        Columns.detallesFact.total_iva,
        Columns.detallesFact.total_costo,
        Columns.detallesFact.total_neto,
        Columns.detallesFact.alicuota_id,
        Columns.detallesFact.precio_ind,
        Columns.detallesFact.descuento_porcentaje,
      ];
      const rows: Promise<Array<Array<any>>> = new Promise(
        (resolve, reject) => {
          const rowsvalues: Array<Array<any>> = [];
          newDetFact.map(async (item, key) => {
            const values = [];
            values.push(factId);
            values.push(item.id_prod);
            values.push(item.nombre_prod);
            values.push(item.cant_prod);
            values.push(item.unidad_tipo_prod);
            values.push(item.total_prod);
            values.push(item.total_iva);
            values.push(item.total_costo);
            values.push(item.total_neto);
            values.push(item.alicuota_id);
            values.push(item.precio_ind);
            values.push(item.descuento_porcentaje);
            rowsvalues.push(values);
            if (key === newDetFact.length - 1) {
              resolve(rowsvalues);
            }
          });
        },
      );
      const resultinsert = await store.mInsert(Tables.DET_FACTURAS, {
        headers: headers,
        rows: await rows,
      });

      const resultInsertStock = await ControllerStock.multipleInsertStock(
        newDetFact,
        newFact.user_id,
        pvId,
        factId,
        newFact.nota_cred,
      );
      return {
        status: 200,
        msg: {
          resultinsert,
          resultInsertStock,
          factId,
        },
      };
    } else {
      return {
        status: 500,
        msg: 'Hubo un error al querer insertar',
      };
    }
  };

  const lastInvoice = async (
    pvId: number,
    fiscal: boolean,
    tipo: any,
    entorno: boolean,
  ): Promise<{ lastInvoice: number }> => {
    const pvData: Array<INewPV> = await ptosVtaController.get(pvId);
    if (fiscal) {
      let certDir = 'drop_test.crt';
      let keyDir = 'drop.key';
      let entornoAlt = false;
      if (process.env.ENTORNO === 'PROD') {
        certDir = pvData[0].cert_file || 'drop_test.crt';
        keyDir = pvData[0].key_file || 'drop.key';
        entornoAlt = true;
      }
      console.log('certDir :>> ', certDir);
      const afip = new AfipClass(pvData[0].cuit, certDir, keyDir, entornoAlt);
      const lastfact = await afip.lastFact(pvData[0].pv, tipo);
      console.log('lastfact :>> ', lastfact);
      if (lastfact.status === 200) {
        return {
          lastInvoice: Number(lastfact.data),
        };
      } else {
        throw new Error(
          'Error interno. Probablemente no sea un punto de venta válido.',
        );
      }
    } else {
      let filter: IWhereParams | undefined = undefined;
      let filters: Array<IWhereParams> = [];

      filter = {
        mode: EModeWhere.strict,
        concat: EConcatWhere.and,
        items: [
          { column: Columns.facturas.pv, object: String(pvData[0].pv) },
          { column: Columns.facturas.fiscal, object: String(0) },
          {
            column: Columns.facturas.cuit_origen,
            object: String(pvData[0].cuit),
          },
          { column: Columns.facturas.t_fact, object: String(tipo) },
        ],
      };
      filters.push(filter);
      const listUlt = await store.list(
        Tables.FACTURAS,
        [`MAX(${Columns.facturas.cbte}) AS lastInvoice`],
        filters,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      if (listUlt[0].lastInvoice > 0) {
        return {
          lastInvoice: listUlt[0].lastInvoice,
        };
      } else {
        return {
          lastInvoice: 0,
        };
      }
    }
  };

  const getFiscalDataInvoice = async (
    ncbte: number,
    pvId: number,
    fiscal: boolean,
    tipo: CbteTipos,
    entorno: boolean,
  ): Promise<
    FactInscriptoProd | FactInscriptoServ | FactMonotribProd | FactMonotribServ
  > => {
    const pvData: Array<INewPV> = await ptosVtaController.get(pvId);

    let certDir = 'drop_test.crt';
    let keyDir = 'drop.key';
    let entornoAlt = false;
    if (process.env.ENTORNO === 'PROD') {
      certDir = pvData[0].cert_file || 'drop_test.crt';
      keyDir = pvData[0].key_file || 'drop.key';
      entornoAlt = true;
    }

    const afip = new AfipClass(pvData[0].cuit, certDir, keyDir, entornoAlt);
    const dataInvoice = await afip.getInvoiceInfo(ncbte, pvData[0].pv, tipo);
    return dataInvoice.data;
  };

  const newInvoice = async (
    pvData: INewPV,
    newFact: IFactura,
    factFiscal:
      | FactInscriptoProd
      | FactInscriptoProdNC
      | FactInscriptoServ
      | FactInscriptoServNC
      | FactMonotribProd
      | FactMonotribProdNC
      | FactMonotribServ
      | FactMonotribServNC
      | any,
    productsList: Array<IDetFactura>,
    fileName: string,
    filePath: string,
    timer: number,
    userData: IUser,
    variosPagos: Array<{
      tipo: MetodosPago;
      tipo_txt: string;
      importe: number;
      fecha_emision: Date;
      fecha_vencimiento: Date;
      banco: string;
      nro_cheque: string;
      notas: string;
    }>,
    next: NextFunction,
    parcial?: boolean,
    originalDetFact?: Array<IDetFactura>,
    newItems?: { id: number; cant_prod: number }[],
  ) => {
    const resultInsert = await insertFact(
      pvData.id || 0,
      newFact,
      productsList,
      factFiscal,
    );

    if (parcial) {
      newItems?.map(async (item) => {
        const itemFind = originalDetFact?.find((i) => i.id === item.id);
        if (itemFind) {
          await store.update(
            Tables.DET_FACTURAS,
            { cant_anulada: itemFind.cant_anulada + item.cant_prod },
            item.id,
          );
        }
      });
    }

    await newmovCtaCte(
      newFact.forma_pago,
      newFact.total_fact,
      newFact.n_doc_cliente,
      resultInsert.msg.factId,
    );

    if (Number(newFact.forma_pago) === 5) {
      variosPagos.map(async (item) => {
        const dataForma: IFormasPago = {
          id_fact: resultInsert.msg.factId,
          tipo: item.tipo,
          importe: item.importe,
          tipo_txt: item.tipo_txt,
          fecha_emision: item.fecha_emision,
          fecha_vencimiento: item.fecha_vencimiento,
          banco: item.banco,
          nro_cheque: item.nro_cheque,
          notas: item.notas,
        };
        await store.insert(Tables.FORMAS_PAGO, dataForma);
        if (Number(item.tipo) === 4) {
          await newmovCtaCte(
            item.tipo,
            item.importe,
            newFact.n_doc_cliente,
            resultInsert.msg.factId,
          );
        }
      });
    }

    if (newFact.id_fact_asoc !== 0 && !parcial) {
      await store.update(
        Tables.FACTURAS,
        { id_fact_asoc: resultInsert.msg.factId },
        newFact.id_fact_asoc,
      );
    }

    setTimeout(() => {
      fs.unlinkSync(filePath);
    }, 6000);
    const difTime = Number(new Date()) - timer;
    console.log('difTime :>> ', difTime);
    const dataFact = {
      fileName,
      filePath,
      resultInsert,
    };
    return dataFact;
  };

  const getDetails = async (fact_id: number): Promise<Array<IDetFactura>> => {
    return await store.getAnyCol(Tables.DET_FACTURAS, { fact_id });
  };

  const newmovCtaCte = async (
    formaPago: number,
    importe: number,
    ndocCliente: number,
    idfact: number,
  ) => {
    if (Number(formaPago) === 4) {
      const clienteArray2: { data: Array<IClientes> } = await controller.list(
        undefined,
        String(ndocCliente),
        undefined,
      );
      const idCliente = clienteArray2.data[0].id;
      await newMovCtaCte({
        id_cliente: idCliente || 0,
        id_factura: idfact,
        id_recibo: 0,
        forma_pago: 4,
        importe: -importe,
        detalle: 'Compra de productos',
      });
    }
  };

  const getDataFact = async (fileName: string, filePath: string) => {
    const dataFact = {
      fileName,
      filePath,
    };

    setTimeout(() => {
      fs.unlinkSync(filePath);
    }, 6000);

    return dataFact;
  };

  const newMovCtaCte = async (body: IMovCtaCte) => {
    return await store.insert(Tables.CTA_CTE, body);
  };

  const changePayType = async (idPay: number, idType: number) => {
    return await store.update(Tables.FACTURAS, { forma_pago: idType }, idPay);
  };

  const getFormasPago = async (idFact: number) => {
    const filter: Array<IWhereParams> = [
      {
        mode: EModeWhere.strict,
        concat: EConcatWhere.none,
        items: [{ column: Columns.formasPago.id_fact, object: String(idFact) }],
      },
    ];

    return await store.list(Tables.FORMAS_PAGO, ['*'], filter);
  };

  const dummyServers = async (
    certFile: string,
    keyFile: string,
    cuit: number,
  ) => {
    let certDir = 'drop_test.crt';
    let keyDir = 'drop.key';
    let entornoAlt = false;

    if (process.env.ENTORNO === 'PROD') {
      certDir = certFile || 'drop_test.crt';
      keyDir = keyFile || 'drop.key';
      entornoAlt = true;
    }
    const nowTime = Number(new Date());
    const afip = new AfipClass(cuit, certDir, keyDir, entornoAlt);
    const dummy = await afip.getServerStatusFact();
    const afterTime = Number(new Date());
    const difference = afterTime - nowTime;
    return {
      statusDummy: dummy,
      difference: difference,
    };
  };

  const correctorNC = async () => {
    const filtersNC: Array<IWhereParams> = [
      {
        mode: EModeWhere.strict,
        concat: EConcatWhere.and,
        items: [{ column: Columns.facturas.nota_cred, object: String(1) }],
      },
    ];

    const listNC: Array<IFactura> = await store.list(
      Tables.FACTURAS,
      ['*'],
      filtersNC,
    );

    listNC.map(async (item) => {
      const idNC = item.id;
      const idFact = item.id_fact_asoc;

      await store.update(Tables.FACTURAS, { id_fact_asoc: idNC }, idFact);
    });

    return {
      listNC,
    };
  };

  const getDetFact = async (idFact: number, all?: boolean) => {
    const filterList: Array<IWhereParams> = [
      {
        mode: EModeWhere.strict,
        concat: EConcatWhere.and,
        items: !all
          ? [{ column: Columns.detallesFact.fact_id, object: String(idFact) }]
          : [{ column: Columns.detallesFact.fact_id, object: String(idFact) }],
      },
    ];
    return await store.list(Tables.DET_FACTURAS, ['*'], filterList);
  };

  const codigoVerificacionDescuento = async (
    total: string,
    descuentoPorcentaje: string,
    descuento: number,
    cliente: string,
  ) => {
    const codigoSeis = Math.floor(Math.random() * 900000) + 100000;
    const vencimiento = moment(
      new Date().setMinutes(new Date().getMinutes() + 7),
    ).format('YYYY-MM-DD HH:mm:ss');
    await store.insert(Tables.CODIGOS_APROBACION, {
      codigo: codigoSeis,
      vencimiento,
    });

    const enviroment = process.env.ENTORNO;

    if (enviroment === 'TEST') {
      await sendCode(
        total,
        descuentoPorcentaje,
        descuento,
        cliente,
        codigoSeis,
        'jretondo90@gmail.com',
        'Código de aprobación de descuento',
        false,
      );
    } else {
      await sendCode(
        total,
        descuentoPorcentaje,
        descuento,
        cliente,
        codigoSeis,
        'jretondo90@gmail.com',
        'Código de aprobación de descuento',
        false,
      );
    }

    return '';
  };

  const verificaCodigo = async (codigo: number) => {
    const filterList: Array<IWhereParams> = [
      {
        mode: EModeWhere.strict,
        concat: EConcatWhere.and,
        items: [
          { column: Columns.codigosAprobacion.codigo, object: String(codigo) },
        ],
      },
    ];
    const list = await store.list(Tables.CODIGOS_APROBACION, ['*'], filterList);
    if (list.length > 0) {
      const fecha = moment(list[0].vencimiento).format('YYYY-MM-DD HH:mm:ss');
      const fechaActual = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
      if (fechaActual > fecha) {
        await store.remove(Tables.CODIGOS_APROBACION, { id: list[0].id });
        return {
          status: 400,
          msg: 'El código ha vencido',
        };
      } else {
        await store.remove(Tables.CODIGOS_APROBACION, { id: list[0].id });
        return {
          status: 200,
          msg: 'Código válido',
        };
      }
    } else {
      return {
        status: 400,
        msg: 'Código inválido',
      };
    }
  };

  const putVariosPagos = async (
    variosPagos: Array<{
      tipo: MetodosPago;
      tipo_txt: string;
      importe: number;
      fecha_emision: Date;
      fecha_vencimiento: Date;
      banco: string;
      nro_cheque: string;
      notas: string;
    }>,
    idFact: number,
  ) => {
    const originalFactura = await get(idFact);

    const totalFactura: number = originalFactura[0].total_fact;
    const totalPagos: number = variosPagos.reduce(
      (acc, item) => acc + roundNumber(item.importe),
      0,
    );

    if (totalFactura !== totalPagos) {
      throw new Error(
        'El total de los pagos no coincide con el total de la factura',
      );
    }

    await store.remove(Tables.FORMAS_PAGO, { id_fact: idFact });
    await store.remove(Tables.CTA_CTE, { id_factura: idFact });

    return variosPagos.map(async (item) => {
      const dataForma: IFormasPago = {
        id_fact: idFact,
        tipo: item.tipo,
        importe: item.importe,
        tipo_txt: item.tipo_txt,
        fecha_emision: item.fecha_emision,
        fecha_vencimiento: item.fecha_vencimiento,
        banco: item.banco,
        nro_cheque: item.nro_cheque,
        notas: item.notas,
      };
      if (Number(item.tipo) === 4) {
        await newmovCtaCte(
          item.tipo,
          item.importe,
          originalFactura[0].n_doc_cliente,
          idFact,
        );
      }
      return await store.insert(Tables.FORMAS_PAGO, dataForma);
    });
  };

  const resetTokenAfip = async () => {
    const tokenFolder = staticFolders.tokenAfip;
    fs.readdir(tokenFolder, (err, files) => {
      if (err) {
        console.log('err :>> ', err);
      }
      for (const file of files) {
        fs.unlink(path.join(tokenFolder, file), (err) => {
          if (err) {
            console.log('err :>> ', err);
          }
        });
      }
    });
    return {
      status: 200,
      msg: 'Token reseteado',
    };
  };

  return {
    lastInvoice,
    list,
    remove,
    get,
    newInvoice,
    getFiscalDataInvoice,
    cajaList,
    getDetails,
    getDataFact,
    changePayType,
    dummyServers,
    correctorNC,
    newMovCtaCte,
    getFormasPago,
    getDetFact,
    codigoVerificacionDescuento,
    verificaCodigo,
    getDetail,
    putVariosPagos,
    resetTokenAfip,
  };
};
