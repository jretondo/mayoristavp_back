import { IJoin, Iorder, Ipages, IWhereParams } from 'interfaces/Ifunctions';
import {
  EConcatWhere,
  EModeWhere,
  ESelectFunct,
  ETypesJoin,
} from '../../../enums/EfunctMysql';
import { Tables, Columns } from '../../../enums/EtablesDB';
import StoreType from '../../../store/mysql';
import getPages from '../../../utils/getPages';
import { IFormasPago } from '../../../interfaces/Itables';

export = (injectedStore: typeof StoreType) => {
  let store = injectedStore;

  const list = async (
    page?: number,
    item?: string,
    cantPerPage?: number,
    estado?: number,
  ) => {
    await updateExpired();
    let filter: IWhereParams | undefined = undefined;
    let filters: Array<IWhereParams> = [
      {
        mode: EModeWhere.strict,
        concat: EConcatWhere.and,
        items: [{ column: Columns.formasPago.tipo, object: String(6) }],
      },
      {
        mode: EModeWhere.strict,
        concat: EConcatWhere.and,
        items: [
          {
            column: `${Tables.FACTURAS}.${Columns.facturas.id_fact_asoc}`,
            object: String(0),
          },
        ],
      },
    ];
    if (item) {
      filter = {
        mode: EModeWhere.like,
        concat: EConcatWhere.or,
        items: [
          { column: Columns.formasPago.banco, object: String(item) },
          { column: Columns.formasPago.notas, object: String(item) },
          { column: Columns.formasPago.nro_cheque, object: String(item) },
        ],
      };
      filters.push(filter);
    }

    if (estado || String(estado) === '0') {
      filter = {
        mode: EModeWhere.strict,
        concat: EConcatWhere.and,
        items: [{ column: Columns.formasPago.estado, object: String(estado) }],
      };
      filters.push(filter);
    }

    let join: IJoin = {
      table: Tables.FACTURAS,
      colJoin: Columns.facturas.id,
      colOrigin: Columns.formasPago.id_fact,
      type: ETypesJoin.none,
    };

    let order: Iorder = {
      columns: [Columns.formasPago.fecha_vencimiento],
      asc: true,
    };

    let pages: Ipages;
    if (page) {
      pages = {
        currentPage: page,
        cantPerPage: cantPerPage || 10,
        order: Columns.formasPago.id,
        asc: true,
      };

      const data = await store.list(
        Tables.FORMAS_PAGO,
        [
          `${Tables.FORMAS_PAGO}.*`,
          `${Tables.FACTURAS}.${Columns.facturas.t_fact} as t_fact`,
        ],
        filters,
        undefined,
        pages,
        [join],
        order,
      );
      const cant = await store.list(
        Tables.FORMAS_PAGO,
        [`COUNT(${ESelectFunct.all}) AS COUNT`],
        filters,
        undefined,
        undefined,
        [join],
      );

      const pagesObj = await getPages(cant[0].COUNT, 10, Number(page));
      return {
        data,
        pagesObj,
      };
    } else {
      const data = await store.list(
        Tables.FORMAS_PAGO,
        [
          `${Tables.FORMAS_PAGO}.*`,
          `${Tables.FACTURAS}.${Columns.facturas.t_fact} as t_fact`,
        ],
        filters,
        undefined,
        undefined,
        [join],
        order,
      );
      return {
        data,
      };
    }
  };

  const get = async (idProv: number) => {
    return await store.get(Tables.FORMAS_PAGO, idProv);
  };

  const updateExpired = async () => {
    const date = new Date();
    date.setDate(date.getDate() - 32);
    const dateStr = `${date.getFullYear()}-${
      date.getMonth() + 1
    }-${date.getDate()}`;
    const filters: Array<IWhereParams> = [
      {
        mode: EModeWhere.lessEqual,
        concat: EConcatWhere.none,
        items: [
          { column: Columns.formasPago.fecha_vencimiento, object: dateStr },
        ],
      },
      {
        mode: EModeWhere.strict,
        concat: EConcatWhere.and,
        items: [{ column: Columns.formasPago.tipo, object: String(6) }],
      },
      {
        mode: EModeWhere.dif,
        concat: EConcatWhere.and,
        items: [{ column: Columns.formasPago.estado, object: String(3) }],
      },
      {
        mode: EModeWhere.strict,
        concat: EConcatWhere.and,
        items: [
          {
            column: `${Tables.FACTURAS}.${Columns.facturas.id_fact_asoc}`,
            object: String(0),
          },
        ],
      },
    ];

    let join: IJoin = {
      table: Tables.FACTURAS,
      colJoin: Columns.facturas.id,
      colOrigin: Columns.formasPago.id_fact,
      type: ETypesJoin.none,
    };

    const data = await store.list(
      Tables.FORMAS_PAGO,
      [`${Tables.FORMAS_PAGO}.*`],
      filters,
      undefined,
      undefined,
      [join],
    );

    const ids = data.map((item: IFormasPago) => item.id);

    const updated =
      ids.lenght > 0 &&
      (await store.update(Tables.FORMAS_PAGO, { estado: 3 }, ids));

    return { data, updated };
  };

  const updateEstado = async (id: number, estado: number) => {
    return await store.update(Tables.FORMAS_PAGO, { estado }, id);
  };

  const updateNotas = async (id: number, notas: string) => {
    return await store.update(Tables.FORMAS_PAGO, { notas }, id);
  };

  return {
    list,
    get,
    updateEstado,
    updateNotas,
  };
};
