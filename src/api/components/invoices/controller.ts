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
import {
  AfipClass,
  AlicuotasIva,
  CbteTipos,
  Conceptos,
  perIvaAlicuotas,
} from '../../../utils/facturacion/AfipClass';
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
import { utils, writeFile } from 'xlsx';

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
    tipo?: string,
    excel?: boolean,
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

    if (tipo) {
      const filter3: IWhereParams = {
        mode: EModeWhere.strict,
        concat: EConcatWhere.and,
        items: [{ column: Columns.facturas.letra, object: tipo }],
      };
      filters.push(filter3);
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

    const pagosFilter: IWhereParams[] = [
      ...filters,
      {
        mode: EModeWhere.strict,
        concat: EConcatWhere.and,
        items: [{ column: Columns.facturas.letra, object: String('OP') }],
      },
    ];

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
      const totalesPagos = await store.list(
        Tables.FACTURAS,
        [
          `SUM(${Columns.facturas.total_fact}) AS SUMA`,
          Columns.facturas.cat_pago,
        ],
        pagosFilter,
        [Columns.facturas.cat_pago],
        undefined,
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
        totalesPagos,
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
      } else if (excel) {
        const dataDetails = await Promise.all(
          data.map(async (item: any) => {
            const pagos = await getFormasPago(item.id);
            return {
              ...item,
              items: await getDetFact(item.id, true),
              pagos: await Promise.all(pagos),
            };
          }),
        );

        const dataProcessedFactura = data.map((item: IFactura) => {
          return {
            Id: item.id,
            Fecha: item.fecha,
            'Tipo de Comprobante': item.letra,
            'Punto de Venta': item.pv,
            'N° Comprobante': item.cbte,
            'Razón Social': item.raz_soc_cliente,
            'N° Documento': item.n_doc_cliente,
            'Total Neto': Number(item.total_neto) + Number(item.descuento),
            'Descuento %': roundNumber(
              (item.descuento /
                (Number(item.total_neto) + Number(item.descuento))) *
                100,
            ),
            'Descuento $': item.descuento,
            'IVA Total': item.total_iva,
            Total: item.total_fact,
          };
        });

        function formaPagoTxt(id: number) {
          switch (Number(id)) {
            case 0:
              return 'Efectivo';
            case 1:
              return 'Mercado Pago';
            case 2:
              return 'Débito';
            case 3:
              return 'Crédito';
            case 4:
              return 'Cuenta Corriente';
            case 5:
              return 'Varios';
            case 6:
              return 'Cheque';
            case 7:
              return 'Transferencia';
            default:
              return '';
          }
        }

        let pagos: any[] = [];
        let detalles: any[] = [];

        dataDetails.map((item: IFactura) => {
          item.pagos && item.pagos.length > 0
            ? item.pagos.map((pago: IFormasPago) => {
                pagos.push({
                  Id: item.id,
                  Fecha: item.fecha,
                  'Tipo de Comprobante': item.letra,
                  'Punto de Venta': item.pv,
                  'N° Comprobante': item.cbte,
                  'Razón Social': item.raz_soc_cliente,
                  'N° Documento': item.n_doc_cliente,
                  'Tipo de Pago': pago.tipo_txt,
                  Importe: pago.importe,
                });
              })
            : pagos.push({
                Id: item.id,
                Fecha: item.fecha,
                'Tipo de Comprobante': item.letra,
                'Punto de Venta': item.pv,
                'N° Comprobante': item.cbte,
                'Razón Social': item.raz_soc_cliente,
                'N° Documento': item.n_doc_cliente,
                'Tipo de Pago': formaPagoTxt(item.forma_pago),
                Importe: item.total_fact,
              });

          item.items &&
            item.items.length > 0 &&
            item.items.map((detalle: IDetFactura) => {
              detalles.push({
                Id: item.id,
                Fecha: item.fecha,
                'Tipo de Comprobante': item.letra,
                'Punto de Venta': item.pv,
                'N° Comprobante': item.cbte,
                'Razón Social': item.raz_soc_cliente,
                'N° Documento': item.n_doc_cliente,
                Producto: detalle.nombre_prod,
                Cantidad: detalle.cant_prod,
                'Precio Unitario': detalle.precio_ind,
                'Total Neto': detalle.precio_ind * detalle.cant_prod,
                'Descuento %': `${detalle.descuento_porcentaje}%`,
                'Descuento $': roundNumber(
                  (detalle.precio_ind *
                    detalle.descuento_porcentaje *
                    detalle.cant_prod) /
                    100,
                ),
                Total: detalle.total_prod,
              });
            });
        });

        const workBook = utils.book_new();
        const workSheet1 = utils.json_to_sheet(dataProcessedFactura);
        const workSheet2 = utils.json_to_sheet(pagos);
        const workSheet3 = utils.json_to_sheet(detalles);

        utils.book_append_sheet(workBook, workSheet1, 'Facturas');
        utils.book_append_sheet(workBook, workSheet2, 'Pagos');
        utils.book_append_sheet(workBook, workSheet3, 'Detalles');
        const uniqueSuffix = moment().format('YYYYMMDDHHmmss');
        const excelAddress = path.join(
          'public',
          'reports',
          uniqueSuffix + '-facturas.xlsx',
        );
        await writeFile(workBook, excelAddress);
        setTimeout(() => {
          fs.unlinkSync(excelAddress);
        }, 2500);
        return {
          filePath: excelAddress,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          fileName: uniqueSuffix + '-facturas.xlsx',
        };
      }

      return {
        data,
        totales,
      };
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
      const afip = new AfipClass(pvData[0].cuit, certDir, keyDir, entornoAlt);
      const lastfact = await afip.lastFact(pvData[0].pv, tipo);
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
        if (Number(item.tipo) === 0) {
          const saldoAnterior = await store.get(
            Tables.PUNTOS_VENTA,
            pvData.id || 0,
          );
          const saldoActual = saldoAnterior[0].saldo_efvo + item.importe;
          await store.update(
            Tables.PUNTOS_VENTA,
            { saldo_efvo: saldoActual },
            pvData.id || 0,
          );
        }
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

  const getCategoriasPago = async () => {
    return await store.list(Tables.CATEGORIA_PAGO, ['*']);
  };

  const newCategoreiaPago = async (categoria: string) => {
    return await store.insert(Tables.CATEGORIA_PAGO, { categoria });
  };

  const repararRefacturacionIva = async (
    originalId: number,
    ncErroneaId: number,
    facturaNuevaId: number,
    fecha: string,
    user: IUser,
    confirm: boolean,
  ) => {
    const preview = await prepararReparacionRefacturacionIva(
      originalId,
      ncErroneaId,
      facturaNuevaId,
      fecha,
      user,
    );

    if (!confirm) {
      return {
        dryRun: true,
        ...preview.resumen,
      };
    }

    const notaDebitoFiscal = await emitirAfip(
      preview.pvData,
      preview.ndFact,
      preview.ndFiscal,
    );
    preview.ndFact.cbte = notaDebitoFiscal.CbteDesde;

    const ndInsert = await persistirFacturaBatch(
      preview.pvData,
      preview.ndFact,
      preview.ndDetails,
      notaDebitoFiscal,
      preview.ndPagos,
    );

    const ncCorrectaFiscal = await emitirAfip(
      preview.pvData,
      preview.ncCorrectaFact,
      preview.ncCorrectaFiscal,
    );
    preview.ncCorrectaFact.cbte = ncCorrectaFiscal.CbteDesde;

    const ncCorrectaInsert = await persistirFacturaBatch(
      preview.pvData,
      preview.ncCorrectaFact,
      preview.ncCorrectaDetails,
      ncCorrectaFiscal,
      preview.ncCorrectaPagos,
    );

    await store.update(
      Tables.FACTURAS,
      { id_fact_asoc: ndInsert.factId },
      ncErroneaId,
    );
    await store.update(
      Tables.FACTURAS,
      { id_fact_asoc: ncCorrectaInsert.factId },
      originalId,
    );

    return {
      dryRun: false,
      notaDebito: {
        id: ndInsert.factId,
        cbte: preview.ndFact.cbte,
        cae: preview.ndFact.cae,
        total: preview.ndFact.total_fact,
        total_neto: preview.ndFact.total_neto,
        total_iva: preview.ndFact.total_iva,
      },
      notaCreditoCorrecta: {
        id: ncCorrectaInsert.factId,
        cbte: preview.ncCorrectaFact.cbte,
        cae: preview.ncCorrectaFact.cae,
        total: preview.ncCorrectaFact.total_fact,
        total_neto: preview.ncCorrectaFact.total_neto,
        total_iva: preview.ncCorrectaFact.total_iva,
      },
    };
  };

  const prepararReparacionRefacturacionIva = async (
    originalId: number,
    ncErroneaId: number,
    facturaNuevaId: number,
    fecha: string,
    user: IUser,
  ) => {
    const fechaComprobante = fecha || moment().format('YYYY-MM-DD');
    const original = (await get(originalId))[0];
    const ncErronea = (await get(ncErroneaId))[0];
    const facturaNueva = (await get(facturaNuevaId))[0];

    if (!original) {
      throw new Error(`Factura original no encontrada: ${originalId}`);
    }
    if (!ncErronea) {
      throw new Error(`Nota de credito erronea no encontrada: ${ncErroneaId}`);
    }
    if (!facturaNueva) {
      throw new Error(`Factura nueva no encontrada: ${facturaNuevaId}`);
    }
    if (!original.fiscal || !ncErronea.fiscal || !facturaNueva.fiscal) {
      throw new Error('Los tres comprobantes deben ser fiscales');
    }
    if (original.nota_cred) {
      throw new Error('El comprobante original no puede ser una nota de credito');
    }
    if (!ncErronea.nota_cred) {
      throw new Error('El comprobante a neutralizar debe ser una nota de credito');
    }
    if (Number(ncErronea.id_fact_asoc) !== Number(original.id)) {
      throw new Error('La NC erronea no esta asociada a la factura original indicada');
    }
    if (Number(facturaNueva.id) === Number(original.id)) {
      throw new Error('La factura nueva debe ser distinta de la original');
    }
    if (
      roundNumber(Math.abs(Number(facturaNueva.total_fact) || 0)) !==
      roundNumber(Math.abs(Number(original.total_fact) || 0))
    ) {
      throw new Error('La factura nueva no tiene el mismo total que la original');
    }

    const pvData: Array<INewPV> = await ptosVtaController.get(original.pv_id);
    const ncErroneaDetails = await getDetails(ncErroneaId);
    const originalDetails = await getDetails(originalId);
    const pagosOriginal = await getFormasPago(originalId);
    const pagosNcErronea = await getFormasPago(ncErroneaId);

    const descuentoNcErronea = getDescuentoPer(ncErronea, ncErroneaDetails);
    const descuentoOriginal = getDescuentoPer(original, originalDetails);

    const ndDetails = construirDetallesNotaDebito(ncErroneaDetails);
    const ncCorrectaDetails = construirDetallesNotaCredito(originalDetails);

    const ndFact = copiarFacturaBase(ncErronea, fechaComprobante, user, {
      letra: getLetraNotaDebito(ncErronea.t_fact),
      t_fact: getTipoNotaDebito(ncErronea.t_fact),
      nota_cred: false,
      id_fact_asoc: ncErronea.id || 0,
      total_fact: Math.abs(Number(ncErronea.total_fact) || 0),
      total_neto: Math.abs(Number(ncErronea.total_neto) || 0),
      total_iva: Math.abs(Number(ncErronea.total_iva) || 0),
      total_compra: Math.abs(Number(ncErronea.total_compra) || 0),
      descuento: Math.abs(Number(ncErronea.descuento) || 0),
    });
    const ncCorrectaFact = copiarFacturaBase(original, fechaComprobante, user, {
      letra: getLetraNotaCredito(original.t_fact),
      t_fact: getTipoNotaCredito(original.t_fact),
      nota_cred: true,
      id_fact_asoc: original.id || 0,
      total_fact: -Math.abs(Number(original.total_fact) || 0),
      total_neto: -Math.abs(Number(original.total_neto) || 0),
      total_iva: -Math.abs(Number(original.total_iva) || 0),
      total_compra: -Math.abs(Number(original.total_compra) || 0),
      descuento: Math.abs(Number(original.descuento) || 0),
    });

    const ndFiscal = construirDataFiscal(
      ndFact,
      ndDetails,
      descuentoNcErronea,
      debeDiscriminarIva(ndFact),
      {
        Tipo: ncErronea.t_fact,
        PtoVta: ncErronea.pv,
        Nro: ncErronea.cbte,
        Cuit: ncErronea.n_doc_cliente,
      },
    );
    const ncCorrectaFiscal = construirDataFiscal(
      ncCorrectaFact,
      ncCorrectaDetails,
      descuentoOriginal,
      debeDiscriminarIva(ncCorrectaFact),
      {
        Tipo: original.t_fact,
        PtoVta: original.pv,
        Nro: original.cbte,
        Cuit: original.n_doc_cliente,
      },
    );

    return {
      pvData: pvData[0],
      ndFact,
      ndDetails,
      ndFiscal,
      ndPagos:
        pagosNcErronea.length > 0
          ? copiarPagos(pagosNcErronea)
          : copiarPagos(pagosOriginal),
      ncCorrectaFact,
      ncCorrectaDetails,
      ncCorrectaFiscal,
      ncCorrectaPagos: invertirPagos(pagosOriginal),
      resumen: {
        original: resumenComprobante(original),
        ncErronea: resumenComprobante(ncErronea),
        facturaNueva: resumenComprobante(facturaNueva),
        notaDebitoAEmitir: {
          tipo: ndFact.t_fact,
          total: ndFact.total_fact,
          total_neto: ndFact.total_neto,
          total_iva: ndFact.total_iva,
          dataFiscal: ndFiscal,
        },
        notaCreditoCorrectaAEmitir: {
          tipo: ncCorrectaFact.t_fact,
          total: ncCorrectaFact.total_fact,
          total_neto: ncCorrectaFact.total_neto,
          total_iva: ncCorrectaFact.total_iva,
          dataFiscal: ncCorrectaFiscal,
        },
      },
    };
  };

  const refacturarIvaBatch = async (
    ids: number[],
    fecha: string,
    user: IUser,
    confirm: boolean,
  ) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('Debe enviar al menos una factura para refacturar');
    }

    const results: Array<any> = [];

    for (const id of ids) {
      try {
        const preview = await prepararRefacturacionIva(id, fecha, user);

        if (!confirm) {
          results.push({
            id,
            dryRun: true,
            ...preview.resumen,
            warnings: preview.warnings,
          });
          continue;
        }

        const notaCreditoFiscal = await emitirAfip(
          preview.pvData,
          preview.ncFact,
          preview.ncFiscal,
        );
        preview.ncFact.cbte = notaCreditoFiscal.CbteDesde;

        const ncInsert = await persistirFacturaBatch(
          preview.pvData,
          preview.ncFact,
          preview.ncDetails,
          notaCreditoFiscal,
          preview.ncPagos,
        );

        const nuevaFiscal = await emitirAfip(
          preview.pvData,
          preview.nuevaFact,
          preview.nuevaFiscal,
        );
        preview.nuevaFact.cbte = nuevaFiscal.CbteDesde;

        const nuevaInsert = await persistirFacturaBatch(
          preview.pvData,
          preview.nuevaFact,
          preview.nuevaDetails,
          nuevaFiscal,
          preview.nuevaPagos,
        );

        await store.update(
          Tables.FACTURAS,
          { id_fact_asoc: ncInsert.factId },
          id,
        );

        results.push({
          id,
          dryRun: false,
          notaCredito: {
            id: ncInsert.factId,
            cbte: preview.ncFact.cbte,
            cae: preview.ncFact.cae,
            total: preview.ncFact.total_fact,
          },
          facturaNueva: {
            id: nuevaInsert.factId,
            cbte: preview.nuevaFact.cbte,
            cae: preview.nuevaFact.cae,
            total: preview.nuevaFact.total_fact,
            total_neto: preview.nuevaFact.total_neto,
            total_iva: preview.nuevaFact.total_iva,
          },
          warnings: preview.warnings,
        });
      } catch (error: any) {
        results.push({
          id,
          error: error?.message || String(error),
        });

        if (confirm) {
          break;
        }
      }
    }

    return {
      confirm,
      results,
    };
  };

  const prepararRefacturacionIva = async (
    id: number,
    fecha: string,
    user: IUser,
  ) => {
    console.log('prepararRefacturacionIva id :>> ', id);
    const fechaComprobante = fecha || moment().format('YYYY-MM-DD');
    const dataFact: Array<IFactura> = await get(id);
    if (!dataFact[0]) {
      throw new Error(`Factura no encontrada: ${id}`);
    }

    const original = dataFact[0];
    if (!original.fiscal) {
      throw new Error('Solo se pueden refacturar comprobantes fiscales');
    }

    if (original.nota_cred) {
      throw new Error('No se puede refacturar una nota de credito');
    }

    if (Number(original.id_fact_asoc) !== 0) {
      throw new Error('La factura ya tiene un comprobante asociado');
    }

    const originalDetails = await getDetails(id);
    const pvData: Array<INewPV> = await ptosVtaController.get(original.pv_id);
    const pagos = await getFormasPago(id);
    const warnings: string[] = [];
    const discriminaIva = debeDiscriminarIva(original);

    const ncDetails = construirDetallesNotaCredito(originalDetails);
    const nuevaDetails = await construirDetallesRefacturados(
      originalDetails,
      discriminaIva,
    );
    const descuentoPer = getDescuentoPer(original, originalDetails);

    const nuevaTotals = calcularTotalesConDescuento(
      nuevaDetails,
      descuentoPer,
      Math.abs(Number(original.total_fact) || 0),
    );

    const ncTipo = getTipoNotaCredito(original.t_fact);
    const ncFact = copiarFacturaBase(original, fechaComprobante, user, {
      letra: getLetraNotaCredito(original.t_fact),
      t_fact: ncTipo,
      nota_cred: true,
      id_fact_asoc: original.id || 0,
      total_fact: -Math.abs(Number(original.total_fact) || 0),
      total_neto: -Math.abs(Number(original.total_neto) || 0),
      total_iva: -Math.abs(Number(original.total_iva) || 0),
      total_compra: -Math.abs(Number(original.total_compra) || 0),
      descuento: Math.abs(Number(original.descuento) || 0),
    });

    const nuevaFact = copiarFacturaBase(original, fechaComprobante, user, {
      letra: original.letra,
      t_fact: original.t_fact,
      nota_cred: false,
      id_fact_asoc: 0,
      total_fact: Math.abs(Number(original.total_fact) || 0),
      total_neto: nuevaTotals.totalNeto,
      total_iva: nuevaTotals.totalIva,
      total_compra: Math.abs(Number(original.total_compra) || 0),
      descuento: Math.abs(Number(original.descuento) || 0),
    });

    const ncFiscal = construirDataFiscal(
      ncFact,
      ncDetails,
      descuentoPer,
      discriminaIva,
      {
        Tipo: original.t_fact,
        PtoVta: original.pv,
        Nro: original.cbte,
        Cuit: original.n_doc_cliente,
      },
    );
    const nuevaFiscal = construirDataFiscal(
      nuevaFact,
      nuevaDetails,
      descuentoPer,
      discriminaIva,
    );

    return {
      pvData: pvData[0],
      ncFact,
      ncDetails,
      ncFiscal,
      ncPagos: invertirPagos(pagos),
      nuevaFact,
      nuevaDetails,
      nuevaFiscal,
      nuevaPagos: copiarPagos(pagos),
      warnings,
      resumen: {
        original: {
          id: original.id,
          cbte: original.cbte,
          tipo: original.t_fact,
          total: original.total_fact,
          total_neto: original.total_neto,
          total_iva: original.total_iva,
        },
        notaCredito: {
          tipo: ncFact.t_fact,
          total: ncFact.total_fact,
          total_neto: ncFact.total_neto,
          total_iva: ncFact.total_iva,
        },
        facturaNueva: {
          tipo: nuevaFact.t_fact,
          total: nuevaFact.total_fact,
          total_neto: nuevaFact.total_neto,
          total_iva: nuevaFact.total_iva,
        },
      },
    };
  };

  const persistirFacturaBatch = async (
    pvData: INewPV,
    factura: IFactura,
    detalles: IDetFactura[],
    factFiscal: any,
    pagos: IFormasPago[],
  ) => {
    const resultInsert = await insertFact(
      pvData.id || 0,
      factura,
      detalles,
      factFiscal,
    );
    const factId = resultInsert.msg.factId;

    await newmovCtaCte(
      factura.forma_pago,
      factura.total_fact,
      factura.n_doc_cliente,
      factId,
    );

    if (Number(factura.forma_pago) === MetodosPago.varios) {
      for (const item of pagos) {
        if (Number(item.tipo) === MetodosPago.efectivo) {
          const saldoAnterior = await store.get(
            Tables.PUNTOS_VENTA,
            pvData.id || 0,
          );
          const saldoActual =
            Number(saldoAnterior[0].saldo_efvo || 0) + Number(item.importe);
          await store.update(
            Tables.PUNTOS_VENTA,
            { saldo_efvo: saldoActual },
            pvData.id || 0,
          );
        }

        await store.insert(Tables.FORMAS_PAGO, {
          id_fact: factId,
          tipo: item.tipo,
          importe: item.importe,
          tipo_txt: item.tipo_txt,
          fecha_emision: item.fecha_emision,
          fecha_vencimiento: item.fecha_vencimiento,
          banco: item.banco,
          nro_cheque: item.nro_cheque,
          notas: item.notas,
        });

        if (Number(item.tipo) === MetodosPago.ctaCte) {
          await newmovCtaCte(
            item.tipo,
            item.importe,
            factura.n_doc_cliente,
            factId,
          );
        }
      }
    }

    return {
      factId,
    };
  };

  const emitirAfip = async (
    pvData: INewPV,
    factura: IFactura,
    dataFiscal: any,
  ) => {
    let certDir = 'drop_test.crt';
    let keyDir = 'drop.key';
    let entornoAlt = false;

    if (process.env.ENTORNO === 'PROD') {
      certDir = pvData.cert_file || 'drop_test.crt';
      keyDir = pvData.key_file || 'drop.key';
      entornoAlt = true;
    }

    const afip = new AfipClass(
      factura.cuit_origen,
      certDir,
      keyDir,
      entornoAlt,
    );
    const data = await afip.newFact(dataFiscal);
    if (Number(data.status) !== 200) {
      throw new Error(`AFIP rechazo el comprobante: ${data.data}`);
    }

    return data.data;
  };

  const copiarFacturaBase = (
    original: IFactura,
    fecha: string,
    user: IUser,
    cambios: Partial<IFactura>,
  ): IFactura => {
    return {
      fecha: fecha as any,
      pv: original.pv,
      cbte: 0,
      letra: cambios.letra || original.letra,
      t_fact: Number(cambios.t_fact || original.t_fact),
      cuit_origen: original.cuit_origen,
      iibb_origen: original.iibb_origen,
      ini_act_origen: original.ini_act_origen,
      direccion_origen: original.direccion_origen,
      raz_soc_origen: original.raz_soc_origen,
      cond_iva_origen: original.cond_iva_origen,
      tipo_doc_cliente: original.tipo_doc_cliente || 99,
      n_doc_cliente: original.n_doc_cliente || 0,
      cond_iva_cliente: original.cond_iva_cliente,
      email_cliente: '',
      nota_cred: Boolean(cambios.nota_cred),
      fiscal: original.fiscal,
      raz_soc_cliente: original.raz_soc_cliente || '',
      user_id: user.id || original.user_id || 0,
      seller_name: `${user.nombre} ${user.apellido}`,
      total_fact: roundNumber(Number(cambios.total_fact) || 0),
      total_iva: roundNumber(Number(cambios.total_iva) || 0),
      total_neto: roundNumber(Number(cambios.total_neto) || 0),
      total_compra: roundNumber(Number(cambios.total_compra) || 0),
      forma_pago: original.forma_pago,
      pv_id: original.pv_id,
      id_fact_asoc: Number(cambios.id_fact_asoc) || 0,
      descuento: roundNumber(Number(cambios.descuento) || 0),
      direccion_entrega: original.direccion_entrega || '',
      telefono: original.telefono || '',
      localidad: original.localidad || '',
      provincia: original.provincia || '',
      cat_pago: original.cat_pago || '',
    };
  };

  const construirDetallesRefacturados = async (
    detalles: IDetFactura[],
    discriminaIva: boolean,
  ): Promise<IDetFactura[]> => {
    const nuevosDetalles: IDetFactura[] = [];

    for (const item of detalles) {
      const producto = await store.get(Tables.PRODUCTS_PRINCIPAL, item.id_prod);
      if (!producto[0]) {
        throw new Error(`Producto no encontrado: ${item.id_prod}`);
      }

      const ivaPorcentaje = discriminaIva ? Number(producto[0].iva) || 0 : 0;
      const totalProd = Math.abs(Number(item.total_prod) || 0);
      const totalNeto =
        discriminaIva && ivaPorcentaje > 0
          ? totalProd / (1 + ivaPorcentaje / 100)
          : totalProd;
      const totalIva = discriminaIva ? totalProd - totalNeto : 0;

      nuevosDetalles.push({
        ...item,
        id: undefined,
        fact_id: undefined,
        cant_anulada: 0,
        total_prod: roundNumber(totalProd),
        total_neto: roundNumber(totalNeto),
        total_iva: roundNumber(totalIva),
        total_costo: Math.abs(Number(item.total_costo) || 0),
        precio_ind: Math.abs(Number(item.precio_ind) || 0),
        alicuota_id:
          discriminaIva && ivaPorcentaje > 0 ? getAlicuotaId(ivaPorcentaje) : 0,
      });
    }

    return nuevosDetalles;
  };

  const construirDetallesNotaCredito = (
    detalles: IDetFactura[],
  ): IDetFactura[] => {
    return detalles.map((item) => ({
      ...item,
      id: undefined,
      fact_id: undefined,
      cant_anulada: 0,
      total_prod: -roundNumber(Math.abs(Number(item.total_prod) || 0)),
      total_neto: -roundNumber(Math.abs(Number(item.total_neto) || 0)),
      total_iva: -roundNumber(Math.abs(Number(item.total_iva) || 0)),
      total_costo: -roundNumber(Math.abs(Number(item.total_costo) || 0)),
      precio_ind: -roundNumber(Math.abs(Number(item.precio_ind) || 0)),
      alicuota_id: item.alicuota_id,
    }));
  };

  const construirDetallesNotaDebito = (
    detalles: IDetFactura[],
  ): IDetFactura[] => {
    return detalles.map((item) => ({
      ...item,
      id: undefined,
      fact_id: undefined,
      cant_anulada: 0,
      total_prod: roundNumber(Math.abs(Number(item.total_prod) || 0)),
      total_neto: roundNumber(Math.abs(Number(item.total_neto) || 0)),
      total_iva: roundNumber(Math.abs(Number(item.total_iva) || 0)),
      total_costo: roundNumber(Math.abs(Number(item.total_costo) || 0)),
      precio_ind: roundNumber(Math.abs(Number(item.precio_ind) || 0)),
      alicuota_id: item.alicuota_id,
    }));
  };

  const calcularTotalesConDescuento = (
    detalles: IDetFactura[],
    descuentoPer: number,
    totalForzado?: number,
  ) => {
    const totalNetoSinDesc = detalles.reduce(
      (acc, item) => acc + Math.abs(Number(item.total_neto) || 0),
      0,
    );
    const totalIvaSinDesc = detalles.reduce(
      (acc, item) => acc + Math.abs(Number(item.total_iva) || 0),
      0,
    );
    const totalFact =
      totalForzado !== undefined
        ? roundNumber(totalForzado)
        : roundNumber(
            detalles.reduce(
              (acc, item) => acc + Math.abs(Number(item.total_prod) || 0),
              0,
            ) *
              (1 - descuentoPer / 100),
          );
    let totalNeto = roundNumber(totalNetoSinDesc * (1 - descuentoPer / 100));
    let totalIva = roundNumber(totalIvaSinDesc * (1 - descuentoPer / 100));

    if (totalIva > 0) {
      totalIva = roundNumber(totalIva + (totalFact - totalNeto - totalIva));
    } else {
      totalNeto = totalFact;
    }

    return {
      totalFact,
      totalNeto,
      totalIva,
    };
  };

  const construirDataFiscal = (
    factura: IFactura,
    detalles: IDetFactura[],
    descuentoPer: number,
    discriminaIva: boolean,
    cbteAsoc?: {
      Tipo: number;
      PtoVta: number;
      Nro: number;
      Cuit: number;
    },
  ) => {
    const requiereAlicIva = debeInformarIvaAfip(factura);
    const totalFact = Math.abs(Number(factura.total_fact) || 0);
    const totalIva = Math.abs(Number(factura.total_iva) || 0);
    const informaIva = requiereAlicIva && totalIva > 0;
    const importeNoGravado = requiereAlicIva && totalIva === 0;
    const ivaList = informaIva ? listaIvaSync(detalles, descuentoPer) : [];

    if (informaIva && ivaList.length === 0) {
      throw new Error(
        `El comprobante ${factura.t_fact} requiere AlicIva pero no se pudo calcular ninguna alicuota.`,
      );
    }

    const dataFiscal: any = {
      CantReg: 1,
      PtoVta: factura.pv,
      CbteTipo: factura.t_fact,
      DocTipo: factura.tipo_doc_cliente,
      DocNro: factura.tipo_doc_cliente === 99 ? 0 : factura.n_doc_cliente,
      CondicionIVAReceptorId: factura.cond_iva_cliente,
      CbteFch: moment(factura.fecha, 'YYYY-MM-DD').format('YYYYMMDD'),
      ImpTotal: totalFact,
      MonCotiz: 1,
      MonId: 'PES',
      Concepto: Conceptos.Productos,
      ImpTotConc: importeNoGravado ? totalFact : 0,
      ImpNeto: importeNoGravado ? 0 : Math.abs(factura.total_neto),
      ImpOpEx: 0,
      ImpIVA: informaIva ? totalIva : 0,
      ImpTrib: 0,
      ...(informaIva ? { Iva: ivaList } : {}),
      ...(cbteAsoc ? { CbtesAsoc: [cbteAsoc] } : {}),
    };

    return dataFiscal;
  };

  const listaIvaSync = (detalles: IDetFactura[], descuentoPer: number) => {
    const grouped = new Map<
      number,
      { Id: AlicuotasIva; BaseImp: number; Importe: number }
    >();

    detalles.forEach((item) => {
      if (Math.abs(Number(item.total_iva) || 0) === 0) {
        return;
      }

      const alicuota = perIvaAlicuotas.find(
        (iva) => Number(iva.id) === Number(item.alicuota_id),
      );
      if (!alicuota) {
        throw new Error(`Alicuota de IVA no valida: ${item.alicuota_id}`);
      }

      const id = alicuota.id as AlicuotasIva;
      const current = grouped.get(id) || { Id: id, BaseImp: 0, Importe: 0 };
      current.BaseImp +=
        Math.abs(Number(item.total_neto) || 0) * (1 - descuentoPer / 100);
      current.Importe +=
        Math.abs(Number(item.total_iva) || 0) * (1 - descuentoPer / 100);
      grouped.set(id, current);
    });

    return Array.from(grouped.values()).map((item) => ({
      Id: item.Id,
      BaseImp: roundNumber(item.BaseImp),
      Importe: roundNumber(item.Importe),
    }));
  };

  const copiarPagos = (pagos: IFormasPago[]) => {
    return pagos.map((item) => ({
      ...item,
      id: undefined,
      id_fact: 0,
      importe: Math.abs(Number(item.importe) || 0),
    }));
  };

  const invertirPagos = (pagos: IFormasPago[]) => {
    return pagos.map((item) => ({
      ...item,
      id: undefined,
      id_fact: 0,
      importe: -Math.abs(Number(item.importe) || 0),
    }));
  };

  const debeDiscriminarIva = (factura: IFactura) => {
    return (
      Number(factura.cond_iva_origen) === 1 && debeInformarIvaAfip(factura)
    );
  };

  const debeInformarIvaAfip = (factura: IFactura) => {
    return [
      CbteTipos['Factura A'],
      CbteTipos['Nota de Débito A'],
      CbteTipos['Nota de Crédito A'],
      CbteTipos['Factura B'],
      CbteTipos['Nota de Débito B'],
      CbteTipos['Nota de Crédito B'],
      CbteTipos['Factura M'],
      CbteTipos['Nota de Débito M'],
      CbteTipos['Nota de Crédito M'],
    ].includes(Number(factura.t_fact));
  };

  const getDescuentoPer = (factura: IFactura, detalles: IDetFactura[]) => {
    const totalDetalles = detalles.reduce(
      (acc, item) => acc + Math.abs(Number(item.total_prod) || 0),
      0,
    );
    const descuento = Math.abs(Number(factura.descuento) || 0);

    return totalDetalles > 0 ? (descuento / totalDetalles) * 100 : 0;
  };

  const getTipoNotaCredito = (tipoFact: number) => {
    switch (Number(tipoFact)) {
      case CbteTipos['Factura A']:
        return CbteTipos['Nota de Crédito A'];
      case CbteTipos['Factura B']:
        return CbteTipos['Nota de Crédito B'];
      case CbteTipos['Factura C']:
        return CbteTipos['Nota de Crédito C'];
      case CbteTipos['Factura M']:
        return CbteTipos['Nota de Crédito M'];
      default:
        throw new Error(`Tipo de factura no soportado: ${tipoFact}`);
    }
  };

  const getTipoNotaDebito = (tipoFact: number) => {
    switch (Number(tipoFact)) {
      case CbteTipos['Nota de Crédito A']:
      case CbteTipos['Factura A']:
        return CbteTipos['Nota de Débito A'];
      case CbteTipos['Nota de Crédito B']:
      case CbteTipos['Factura B']:
        return CbteTipos['Nota de Débito B'];
      case CbteTipos['Nota de Crédito C']:
      case CbteTipos['Factura C']:
        return CbteTipos['Nota de Débito C'];
      case CbteTipos['Nota de Crédito M']:
      case CbteTipos['Factura M']:
        return CbteTipos['Nota de Débito M'];
      default:
        throw new Error(`Tipo de comprobante no soportado para nota de debito: ${tipoFact}`);
    }
  };

  const getLetraNotaCredito = (tipoFact: number) => {
    switch (Number(tipoFact)) {
      case CbteTipos['Factura A']:
        return 'NC A';
      case CbteTipos['Factura B']:
        return 'NC B';
      case CbteTipos['Factura C']:
        return 'NC C';
      case CbteTipos['Factura M']:
        return 'NC M';
      default:
        return 'DEV';
    }
  };

  const getLetraNotaDebito = (tipoFact: number) => {
    switch (Number(tipoFact)) {
      case CbteTipos['Nota de Crédito A']:
      case CbteTipos['Factura A']:
        return 'ND A';
      case CbteTipos['Nota de Crédito B']:
      case CbteTipos['Factura B']:
        return 'ND B';
      case CbteTipos['Nota de Crédito C']:
      case CbteTipos['Factura C']:
        return 'ND C';
      case CbteTipos['Nota de Crédito M']:
      case CbteTipos['Factura M']:
        return 'ND M';
      default:
        return 'ND';
    }
  };

  const resumenComprobante = (factura: IFactura) => {
    return {
      id: factura.id,
      letra: factura.letra,
      pv: factura.pv,
      cbte: factura.cbte,
      tipo: factura.t_fact,
      total: factura.total_fact,
      total_neto: factura.total_neto,
      total_iva: factura.total_iva,
      id_fact_asoc: factura.id_fact_asoc,
      cae: factura.cae,
    };
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
    getCategoriasPago,
    newCategoreiaPago,
    refacturarIvaBatch,
    repararRefacturacionIva,
  };
};
