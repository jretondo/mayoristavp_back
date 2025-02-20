import { IJoin, INewInsert } from './../../../interfaces/Ifunctions';
import {
  IFactura,
  IFormasPago,
  IMovCtaCte,
} from './../../../interfaces/Itables';
import { AfipClass } from './../../../utils/facturacion/AfipClass';
import { Ipages, IWhereParams } from 'interfaces/Ifunctions';
import { IClientes } from 'interfaces/Itables';
import {
  EConcatWhere,
  EModeWhere,
  ESelectFunct,
  ETypesJoin,
} from '../../../enums/EfunctMysql';
import { Tables, Columns } from '../../../enums/EtablesDB';
import StoreType from '../../../store/mysql';
import getPages from '../../../utils/getPages';
import { NextFunction } from 'express';
import fs from 'fs';
import { utils, writeFile } from 'xlsx';
import path from 'path';
import moment from 'moment';
import { createListCtaCtePDF } from '../../../utils/facturacion/lists/createListCtaCtePDF';

export = (injectedStore: typeof StoreType) => {
  let store = injectedStore;

  const list = async (page?: number, item?: string, cantPerPage?: number) => {
    let filter: IWhereParams | undefined = undefined;
    let filters: Array<IWhereParams> = [];
    if (item) {
      filter = {
        mode: EModeWhere.like,
        concat: EConcatWhere.or,
        items: [
          { column: Columns.clientes.telefono, object: String(item) },
          { column: Columns.clientes.email, object: String(item) },
          { column: Columns.clientes.ndoc, object: String(item) },
          { column: Columns.clientes.razsoc, object: String(item) },
        ],
      };
      filters.push(filter);
    }

    let pages: Ipages;
    if (page) {
      pages = {
        currentPage: page,
        cantPerPage: cantPerPage || 10,
        order: Columns.clientes.id,
        asc: true,
      };
      const data = await store.list(
        Tables.CLIENTES,
        [ESelectFunct.all],
        filters,
        undefined,
        pages,
      );
      const cant = await store.list(
        Tables.CLIENTES,
        [`COUNT(${ESelectFunct.all}) AS COUNT`],
        filters,
        undefined,
        undefined,
      );
      const pagesObj = await getPages(cant[0].COUNT, 10, Number(page));
      return {
        data,
        pagesObj,
      };
    } else {
      const data = await store.list(
        Tables.CLIENTES,
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

  const upsert = async (body: IClientes, next: NextFunction) => {
    const cliente: IClientes = {
      cuit: body.cuit,
      ndoc: body.ndoc,
      razsoc: body.razsoc,
      telefono: body.telefono,
      email: body.email,
      cond_iva: body.cond_iva,
      direccion: body.direccion,
      entrega: body.entrega,
      provincia: body.provincia,
      localidad: body.localidad,
    };

    try {
      if (body.id) {
        return await store.update(Tables.CLIENTES, cliente, body.id);
      } else {
        return await store.insert(Tables.CLIENTES, cliente);
      }
    } catch (error) {
      next(error);
    }
  };

  const remove = async (idCliente: number) => {
    const listCtaCte: {
      data: Array<IMovCtaCte>;
    } = await listCtaCteClient(idCliente, false, false);
    const cant = listCtaCte.data.length;
    if (cant > 0) {
      return 403;
    } else {
      const result: any = await store.remove(Tables.CLIENTES, {
        id: idCliente,
      });

      if (result.affectedRows > 0) {
        return 200;
      } else {
        return 500;
      }
    }
  };

  const get = async (idCliente: number) => {
    return await store.get(Tables.CLIENTES, idCliente);
  };

  const dataFiscalPadron = async (
    cuit: number,
    cert: string,
    key: string,
    cuitPv: number,
  ) => {
    let certDir = 'jretondo.crt';
    let keyDir = 'jretondo.key';
    const afip = new AfipClass(20350925148, certDir, keyDir, true);
    const dataFiscal = await afip.getDataCUIT(cuit);
    return dataFiscal;
  };

  const listCtaCteClient = async (
    idCliente: number,
    debit: boolean,
    credit: boolean,
    page?: number,
    cantPerPage?: number,
  ) => {
    let filter: IWhereParams | undefined = undefined;
    let filters: Array<IWhereParams> = [];

    if (!debit && !credit) {
      filter = {
        mode: EModeWhere.strict,
        concat: EConcatWhere.none,
        items: [
          { column: Columns.ctaCte.id_cliente, object: String(idCliente) },
        ],
      };
      filters.push(filter);
    } else if (debit) {
      filter = {
        mode: EModeWhere.strict,
        concat: EConcatWhere.and,
        items: [
          { column: Columns.ctaCte.id_cliente, object: String(idCliente) },
        ],
      };
      filters.push(filter);

      filter = {
        mode: EModeWhere.less,
        concat: EConcatWhere.and,
        items: [{ column: Columns.ctaCte.importe, object: String(0) }],
      };
      filters.push(filter);
    } else if (credit) {
      filter = {
        mode: EModeWhere.strict,
        concat: EConcatWhere.and,
        items: [
          { column: Columns.ctaCte.id_cliente, object: String(idCliente) },
        ],
      };
      filters.push(filter);

      filter = {
        mode: EModeWhere.higher,
        concat: EConcatWhere.and,
        items: [{ column: Columns.ctaCte.importe, object: String(0) }],
      };
      filters.push(filter);
    }

    let pages: Ipages;
    if (page) {
      pages = {
        currentPage: page,
        cantPerPage: cantPerPage || 10,
        order: Columns.clientes.id,
        asc: false,
      };
      const data = await store.list(
        Tables.CTA_CTE,
        [ESelectFunct.all],
        filters,
        undefined,
        pages,
      );
      const cant = await store.list(
        Tables.CTA_CTE,
        [`COUNT(${ESelectFunct.all}) AS COUNT`],
        filters,
      );
      const suma = await store.list(
        Tables.CTA_CTE,
        [`SUM(${Columns.ctaCte.importe}) as SUMA`],
        filters,
      );
      const pagesObj = await getPages(cant[0].COUNT, 10, Number(page));
      return {
        data,
        pagesObj,
        suma,
      };
    } else {
      const data = await store.list(
        Tables.CTA_CTE,
        [ESelectFunct.all],
        filters,
        undefined,
        undefined,
      );
      const suma = await store.list(
        Tables.CTA_CTE,
        [`SUM(${Columns.ctaCte.importe}) as SUMA`],
        filters,
      );
      return {
        data,
        suma,
      };
    }
  };

  const listCtaCte = async (
    debit: boolean,
    credit: boolean,
    desde: string,
    hasta: string,
    cliente?: string,
    page?: number,
    cantPerPage?: number,
    pdf?: boolean,
    excel?: boolean,
  ) => {
    let filter: IWhereParams | undefined = undefined;
    let filters: Array<IWhereParams> = [];

    if (debit) {
      filter = {
        mode: EModeWhere.less,
        concat: EConcatWhere.and,
        items: [{ column: Columns.ctaCte.importe, object: String(0) }],
      };
      filters.push(filter);
    } else if (credit) {
      filter = {
        mode: EModeWhere.higher,
        concat: EConcatWhere.and,
        items: [{ column: Columns.ctaCte.importe, object: String(0) }],
      };
      filters.push(filter);
    }

    if (cliente) {
      filter = {
        mode: EModeWhere.like,
        concat: EConcatWhere.or,
        items: [
          {
            column: `${Tables.CLIENTES}.${Columns.clientes.razsoc}`,
            object: String(cliente),
          },
          {
            column: `${Tables.CLIENTES}.${Columns.clientes.ndoc}`,
            object: String(cliente),
          },
        ],
      };
      filters.push(filter);
    }

    filters.push({
      mode: EModeWhere.higherEqual,
      concat: EConcatWhere.and,
      items: [
        {
          column: `${Tables.CTA_CTE}.${Columns.ctaCte.fecha}`,
          object: String(desde),
        },
      ],
    });

    filters.push({
      mode: EModeWhere.lessEqual,
      concat: EConcatWhere.and,
      items: [
        {
          column: `${Tables.CTA_CTE}.${Columns.ctaCte.fecha}`,
          object: String(hasta),
        },
      ],
    });

    let pages: Ipages;

    const join: IJoin = {
      table: Tables.CLIENTES,
      colOrigin: Columns.ctaCte.id_cliente,
      colJoin: Columns.clientes.id,
      type: ETypesJoin.left,
    };

    if (page) {
      pages = {
        currentPage: page,
        cantPerPage: cantPerPage || 10,
        order: Columns.clientes.id,
        asc: false,
      };
      const data = await store.list(
        Tables.CTA_CTE,
        [
          `${Tables.CTA_CTE}.${Columns.ctaCte.id}`,
          Columns.ctaCte.id_cliente,
          Columns.ctaCte.id_factura,
          Columns.ctaCte.id_recibo,
          Columns.ctaCte.forma_pago,
          Columns.ctaCte.importe,
          Columns.ctaCte.detalle,
          Columns.ctaCte.fecha,
          Columns.clientes.razsoc,
          Columns.clientes.ndoc,
        ],
        filters,
        undefined,
        pages,
        [join],
      );
      const cant = await store.list(
        Tables.CTA_CTE,
        [`COUNT(${ESelectFunct.all}) AS COUNT`],
        filters,
        undefined,
        undefined,
        [join],
      );
      const suma = await store.list(
        Tables.CTA_CTE,
        [`SUM(${Columns.ctaCte.importe}) as SUMA`],
        filters,
        undefined,
        undefined,
        [join],
      );
      const pagesObj = await getPages(cant[0].COUNT, 10, Number(page));
      return {
        data,
        pagesObj,
        suma,
      };
    } else {
      const join2: IJoin = {
        table: Tables.FACTURAS,
        colOrigin: Columns.ctaCte.id_factura,
        colJoin: Columns.facturas.id,
        type: ETypesJoin.left,
      };
      const data = await store.list(
        Tables.CTA_CTE,
        [
          `${Tables.CTA_CTE}.${Columns.ctaCte.id}`,
          `${Tables.CTA_CTE}.${Columns.ctaCte.fecha}`,
          Columns.ctaCte.id_cliente,
          Columns.ctaCte.id_factura,
          Columns.ctaCte.id_recibo,
          Columns.ctaCte.importe,
          Columns.ctaCte.detalle,
          Columns.clientes.razsoc,
          Columns.clientes.ndoc,
          Columns.clientes.cuit,
          Columns.facturas.letra,
          Columns.facturas.pv,
          Columns.facturas.cbte,
          Columns.facturas.t_fact,
        ],
        filters,
        undefined,
        undefined,
        [join, join2],
      );
      const suma = await store.list(
        Tables.CTA_CTE,
        [`SUM(${Columns.ctaCte.importe}) as SUMA`],
        filters,
        undefined,
        undefined,
        [join],
      );

      if (excel) {
        const dataProcessed = data.map((item: any) => {
          return {
            Id: item.id,
            Fecha: item.fecha,
            Cliente: item.razsoc,
            Documento: item.ndoc,
            Detalle: item.detalle,
            Importe: item.importe,
            Letra: item.letra,
            'Punto de Venta': item.pv,
            Comprobante: item.cbte,
          };
        });
        const workBook = utils.book_new();
        const workSheet1 = utils.json_to_sheet(dataProcessed);
        utils.book_append_sheet(workBook, workSheet1, 'CtaCte');
        const uniqueSuffix = moment().format('YYYYMMDDHHmmss');
        const excelAddress = path.join(
          'public',
          'reports',
          uniqueSuffix + '-ctacte.xlsx',
        );
        await writeFile(workBook, excelAddress);
        setTimeout(() => {
          fs.unlinkSync(excelAddress);
        }, 2500);
        return {
          filePath: excelAddress,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          fileName: uniqueSuffix + '-ctacte.xlsx',
        };
      } else if (pdf) {
        const cajaList: any = await createListCtaCtePDF(
          desde,
          hasta,
          suma[0].SUMA,
          data,
          cliente,
        );
        try {
          setTimeout(() => {
            fs.unlinkSync(cajaList.filePath);
          }, 2500);
        } catch (error) {}
        return cajaList;
      }
      return {
        data,
        suma,
      };
    }
  };

  const registerPayment = async (
    newFact: IFactura,
    fileName: string,
    filePath: string,
    clienteData: IClientes,
    pagos: IFormasPago[],
    next: NextFunction,
  ) => {
    const result: INewInsert = await store.insert(Tables.FACTURAS, newFact);

    if (result.affectedRows > 0) {
      const ctacteData = {
        id_cliente: clienteData.id || 0,
        id_factura: result.insertId,
        id_recibo: result.insertId,
        forma_pago: newFact.forma_pago,
        importe: newFact.total_fact,
        detalle: 'Recibo de Pago',
      };
      const resultCtaCte = await store.insert(Tables.CTA_CTE, ctacteData);

      pagos.map(async (pago) => {
        await store.insert(Tables.FORMAS_PAGO, {
          id_fact: result.insertId,
          tipo: pago.tipo,
          importe: pago.importe,
          tipo_txt: pago.tipo_txt,
          fecha_emision: pago.fecha_emision,
          fecha_vencimiento: pago.fecha_vencimiento,
          banco: pago.banco,
          nro_cheque: pago.nro_cheque,
          notas: pago.notas,
        });
      });

      setTimeout(() => {
        fs.unlinkSync(filePath);
      }, 6000);

      const dataFact = {
        fileName,
        filePath,
        resultInsert: resultCtaCte,
      };
      return dataFact;
    } else {
      throw new Error('Error interno. No se pudo registrar el nuevo recibo.');
    }
  };

  const getDataPayment = async (fileName: string, filePath: string) => {
    const dataFact = {
      fileName,
      filePath,
    };
    return dataFact;
  };

  const deletePayment = async (idFactura: number) => {
    try {
      const deleted: any = await store.removeWhere(
        Tables.FACTURAS,
        [
          { column: Columns.facturas.id, value: idFactura },
          { column: Columns.facturas.t_fact, value: -1 },
        ],
        'AND',
      );

      if (deleted && deleted.affectedRows > 0) {
        await store.remove(Tables.CTA_CTE, {
          id_factura: idFactura,
        });
        await store.remove(Tables.FORMAS_PAGO, {
          id_fact: idFactura,
        });
        return deleted;
      } else {
        throw new Error('Error interno. No se pudo eliminar el recibo.');
      }
    } catch (error) {
      console.log('error', error);
      throw new Error('Error interno. No se pudo eliminar el recibo.');
    }
  };

  return {
    list,
    upsert,
    remove,
    get,
    dataFiscalPadron,
    listCtaCteClient,
    registerPayment,
    getDataPayment,
    deletePayment,
    listCtaCte,
  };
};
