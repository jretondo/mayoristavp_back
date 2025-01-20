import { IJoin, INewInsert } from 'interfaces/Ifunctions';
import {
  EConcatWhere,
  EModeWhere,
  ETypesJoin,
} from '../../../enums/EfunctMysql';
import { Tables, Columns } from '../../../enums/EtablesDB';
import StoreType from '../../../store/mysql';
import { IPedido } from '../../../interfaces/Itables';

export = (injectedStore: typeof StoreType) => {
  let store = injectedStore;

  const get = async (id_pedido: number) => {
    const pedido = await store.get(Tables.PEDIDOS, id_pedido);
    const join: IJoin[] = [
      {
        table: Tables.PRODUCTS_PRINCIPAL,
        colJoin: Columns.prodPrincipal.id,
        colOrigin: Columns.pedidosItems.id_prod,
        type: ETypesJoin.none,
      },
    ];

    const items = await store.list(
      Tables.PEDIDO_ITEMS,
      [
        `${Tables.PRODUCTS_PRINCIPAL}.*, ${Tables.PEDIDO_ITEMS}.${Columns.pedidosItems.cant_prod}, ${Tables.PEDIDO_ITEMS}.${Columns.pedidosItems.id_prod}`,
      ],
      [
        {
          mode: EModeWhere.strict,
          concat: EConcatWhere.none,
          items: [
            {
              column: Columns.pedidosItems.id_pedido,
              object: String(id_pedido),
            },
          ],
        },
      ],
      undefined,
      undefined,
      join,
    );

    return {
      data: {
        ...pedido,
        items,
      },
    };
  };

  const newOrder = async (data: IPedido) => {
    if (!data.items || data.items.length === 0) {
      throw new Error('No se puede crear un pedido sin items');
    }
    let pedido: INewInsert | null = null;
    try {
      const { items, ...rest } = data;
      pedido = await store.insert(Tables.PEDIDOS, {
        ...rest,
        fecha: new Date(),
      });

      if (!pedido || !pedido.insertId || pedido === null) {
        throw new Error('No se pudo crear el pedido');
      }
      items.map(async (item) => {
        await store.insert(Tables.PEDIDO_ITEMS, {
          ...item,
          id_pedido: pedido?.insertId,
        });
      });
      return { id: pedido.insertId };
    } catch (error) {
      if (pedido && pedido.insertId) {
        await store.remove(Tables.PEDIDOS, { id: pedido.insertId });
      }
      throw new Error('No se pudo crear el pedido. Error: ' + error);
    }
  };

  return {
    get,
    newOrder,
  };
};
