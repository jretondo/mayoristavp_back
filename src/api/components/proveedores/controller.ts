import { INewInsert, Ipages, IWhereParams } from 'interfaces/Ifunctions';
import { IFactura, IFormasPago, IProveedor } from 'interfaces/Itables';
import {
  EConcatWhere,
  EModeWhere,
  ESelectFunct,
} from '../../../enums/EfunctMysql';
import { Tables, Columns } from '../../../enums/EtablesDB';
import StoreType from '../../../store/mysql';
import getPages from '../../../utils/getPages';
import { NextFunction } from 'express';
import fs from 'fs';

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
          { column: Columns.proveedores.telefono, object: String(item) },
          { column: Columns.proveedores.email, object: String(item) },
          { column: Columns.proveedores.ndoc, object: String(item) },
          { column: Columns.proveedores.razsoc, object: String(item) },
        ],
      };
      filters.push(filter);
    }

    let pages: Ipages;
    if (page) {
      pages = {
        currentPage: page,
        cantPerPage: cantPerPage || 10,
        order: Columns.proveedores.id,
        asc: true,
      };
      const data = await store.list(
        Tables.PROVEEDORES,
        [ESelectFunct.all],
        filters,
        undefined,
        pages,
      );
      const cant = await store.list(
        Tables.PROVEEDORES,
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
        Tables.PROVEEDORES,
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

  const upsert = async (body: IProveedor) => {
    const proveedor: IProveedor = {
      cuit: body.cuit,
      ndoc: body.ndoc,
      razsoc: body.razsoc,
      telefono: body.telefono,
      email: body.email,
      cond_iva: body.cond_iva,
      fantasia: body.fantasia,
      obs: body.obs,
      keyword: body.keyword,
    };

    if (body.id) {
      return await store.update(Tables.PROVEEDORES, proveedor, body.id);
    } else {
      return await store.insert(Tables.PROVEEDORES, proveedor);
    }
  };

  const remove = async (idProv: number) => {
    return await store.remove(Tables.PROVEEDORES, { id: idProv });
  };

  const get = async (idProv: number) => {
    return await store.get(Tables.PROVEEDORES, idProv);
  };

  const registerOP = async (
    newFact: IFactura,
    fileName: string,
    filePath: string,
    pagos: IFormasPago[],
    next: NextFunction,
  ) => {
    const result: INewInsert = await store.insert(Tables.FACTURAS, newFact);
    console.log(pagos);
    if (result.affectedRows > 0) {
      pagos.map(async (pago) => {
        if (pago.tipo === 6) {
          pago.id_cheque &&
            (await store.update(
              Tables.FORMAS_PAGO,
              { estado: 4, id_fact_pago: result.insertId },
              pago.id_cheque,
            ));
        }
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
      };
      return dataFact;
    } else {
      throw new Error('Error interno. No se pudo registrar el nuevo recibo.');
    }
  };

  return {
    list,
    upsert,
    remove,
    get,
    registerOP,
  };
};
