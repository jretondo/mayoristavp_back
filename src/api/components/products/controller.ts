import { createProdListPDF } from './../../../utils/facturacion/lists/createListProducts';
import {
  EConcatWhere,
  EModeWhere,
  ESelectFunct,
  ETypesJoin,
} from '../../../enums/EfunctMysql';
import { Tables, Columns } from '../../../enums/EtablesDB';
import StoreType from '../../../store/mysql';
import getPages from '../../../utils/getPages';
import path from 'path';
import fs from 'fs';
import { staticFolders } from '../../../enums/EStaticFiles';
import OptimizeImg from '../../../utils/optimeImg';
import {
  IJoin,
  Iorder,
  Ipages,
  IWhere,
  IWhereParams,
} from 'interfaces/Ifunctions';
import { INewProduct } from 'interfaces/Irequests';
import { IImgProd } from 'interfaces/Itables';
import StockController from '../stock';

export = (injectedStore: typeof StoreType) => {
  let store = injectedStore;

  const list = async (
    page?: number,
    item?: string,
    cantPerPage?: number,
    advanced?: boolean,
    name?: string,
    provider?: string,
    brand?: string,
    stock?: boolean,
  ) => {
    let filter: IWhereParams | undefined = undefined;
    let filters: Array<IWhereParams> = [];
    let conID = false;
    let idProd = 0;

    if (advanced) {
      filter = {
        mode: EModeWhere.like,
        concat: EConcatWhere.and,
        items: [
          { column: Columns.prodPrincipal.name, object: String(name) },
          { column: Columns.prodPrincipal.subcategory, object: String(brand) },
          { column: Columns.prodPrincipal.category, object: String(provider) },
        ],
      };
      filters.push(filter);
    } else {
      if (item) {
        if (item.includes('id:')) {
          conID = true;
          idProd = Number(item.replace('id:', ''));
        } else {
          const arrayStr = item.split(' ');
          arrayStr.map((subItem) => {
            filter = {
              mode: EModeWhere.like,
              concat: EConcatWhere.or,
              items: [
                { column: Columns.prodPrincipal.name, object: String(subItem) },
                {
                  column: Columns.prodPrincipal.subcategory,
                  object: String(subItem),
                },
                {
                  column: Columns.prodPrincipal.category,
                  object: String(subItem),
                },
                {
                  column: Columns.prodPrincipal.short_decr,
                  object: String(subItem),
                },
                {
                  column: Columns.prodPrincipal.cod_barra,
                  object: String(subItem),
                },
              ],
            };
            filters.push(filter);
          });
        }
      }
    }

    if (conID) {
      let data = await store.get(Tables.PRODUCTS_PRINCIPAL, idProd);
      data[0].id_prod = data[0].id;

      if (stock) {
        data = data.map(async (item: any) => {
          const stock = await StockController.getStockProd(item.id_prod);
          item.stock = stock;
          return item;
        });
      }

      return {
        data: await Promise.all(data),
      };
    } else {
      const groupBy: Array<string> = [
        `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.id}`,
      ];

      const joinQuery: IJoin = {
        table: Tables.PRODUCTS_IMG,
        colJoin: Columns.prodImg.id_prod,
        colOrigin: Columns.prodPrincipal.id,
        type: ETypesJoin.left,
      };

      let pages: Ipages;
      if (page) {
        pages = {
          currentPage: page,
          cantPerPage: cantPerPage || 10,
          order: `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.name}`,
          asc: true,
        };
        let data = await store.list(
          Tables.PRODUCTS_PRINCIPAL,
          [
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.id} as id_prod`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.name}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.fecha_carga}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.cod_barra}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.short_decr}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.enabled}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.category}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.subcategory}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.unidad}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.precio_compra}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.porc_minor}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.iva}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.vta_price}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.vta_fija}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.round}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.id_prov}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.family}`,
            `${Tables.PRODUCTS_IMG}.${Columns.prodImg.url_img}`,
          ],
          filters,
          groupBy,
          pages,
          [joinQuery],
        );
        const cant = await store.list(
          Tables.PRODUCTS_PRINCIPAL,
          [`COUNT(${ESelectFunct.all}) AS COUNT`],
          filters,
        );
        const pagesObj = await getPages(cant[0].COUNT, 10, Number(page));

        if (stock) {
          data = data.map(async (item: any) => {
            const stock = await StockController.getStockProd(item.id_prod);
            item.stock = stock;
            return item;
          });
        }

        return {
          data: await Promise.all(data),
          pagesObj,
        };
      } else {
        const data = await store.list(
          Tables.PRODUCTS_PRINCIPAL,
          [
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.id} as id_prod`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.name}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.fecha_carga}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.cod_barra}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.short_decr}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.enabled}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.category}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.subcategory}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.unidad}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.precio_compra}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.porc_minor}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.iva}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.vta_price}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.vta_fija}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.round}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.id_prov}`,
            `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.family}`,
            `${Tables.PRODUCTS_IMG}.${Columns.prodImg.url_img}`,
          ],
          filters,
          groupBy,
          undefined,
          [joinQuery],
        );
        return {
          data,
        };
      }
    }
  };

  const publicList = async () => {
    const filters: Array<IWhereParams> = [];
    const filter: IWhereParams = {
      mode: EModeWhere.strict,
      concat: EConcatWhere.none,
      items: [{ column: Columns.prodPrincipal.enabled, object: '1' }],
    };
    filters.push(filter);
    const order: Iorder = {
      columns: [
        Columns.prodPrincipal.family,
        Columns.prodPrincipal.subcategory,
        Columns.prodPrincipal.name,
      ],
      asc: true,
    };
    const joinQuery: IJoin = {
      table: Tables.STOCK,
      colJoin: Columns.stock.id_prod,
      colOrigin: Columns.prodPrincipal.id,
      type: ETypesJoin.left,
    };
    const groupBy: Array<string> = [
      `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.id}`,
      Columns.prodPrincipal.subcategory,
    ];
    const lista: Array<INewProduct> = await store.list(
      Tables.PRODUCTS_PRINCIPAL,
      [
        '*',
        `${Tables.PRODUCTS_PRINCIPAL}.${Columns.prodPrincipal.id} as id_prod`,
        `SUM(${Columns.stock.cant}) as stock`,
      ],
      filters,
      groupBy,
      undefined,
      [joinQuery],
      order,
    );
    return new Promise((resolve, reject) => {
      let products: Array<any> = [];
      lista.map(async (item, key) => {
        const sku = item.cod_barra;
        const name = item.name;
        let filter2: IWhereParams | undefined = undefined;
        let filters2: Array<IWhereParams> = [];
        let stock = item.stock;
        if (!item.stock || item.stock < 0) {
          stock = 0;
        }

        filter2 = {
          mode: EModeWhere.strict,
          concat: EConcatWhere.none,
          items: [
            { column: Columns.prodImg.id_prod, object: String(item.id_prod) },
          ],
        };

        filters2.push(filter2);

        const cat = item.category;
        const subCat = item.subcategory;
        const family = item.family;
        const category = [family];
        const saleCount = 100;
        const nuevo = false;
        const discount = 0;

        const prices: Array<any> = [
          {
            type_price_name: 'MINORISTA',
            sell_price: item.vta_price,
            min: 0,
          },
        ];

        const groupBy2: Array<string> = [Columns.prodImg.url_img];
        const shortDescription = item.short_descr;
        const image = await store.list(
          Tables.PRODUCTS_IMG,
          ['*'],
          filters2,
          groupBy2,
        );
        products.push({
          id: item.id_prod,
          sku,
          name,
          category,
          saleCount,
          nuevo,
          discount,
          shortDescription,
          image,
          prices,
          stock,
        });
        if (key === lista.length - 1) {
          resolve({
            products,
          });
        }
      });
    });
  };

  const upsert = async (body: INewProduct, listImgDelete?: Array<string>) => {
    const product: INewProduct = {
      name: body.name,
      short_descr: body.short_descr,
      category: body.category,
      subcategory: body.subcategory,
      precio_compra: body.precio_compra,
      unidad: body.unidad,
      porc_minor: body.porc_minor,
      cod_barra: body.cod_barra,
      round: body.round,
      iva: body.iva,
      id_prov: body.id_prov,
      vta_price: body.vta_price,
      vta_fija: Boolean(body.vta_fija),
      family: body.family,
      min_stock: body.min_stock,
    };

    if (body.id) {
      const result = await store.update(
        Tables.PRODUCTS_PRINCIPAL,
        product,
        body.id,
      );
      if (result.affectedRows > 0) {
        if (listImgDelete) {
          try {
            listImgDelete.map(async (img) => {
              const file: string = path.join(staticFolders.products, img || '');
              fs.unlinkSync(file);
              await store.remove(Tables.PRODUCTS_IMG, { url_img: img });
            });
          } catch (error) {
            const file: string = path.join(
              staticFolders.products,
              String(listImgDelete) || '',
            );
            fs.unlinkSync(file);
            await store.remove(Tables.PRODUCTS_IMG, { url_img: listImgDelete });
          }
        }

        if (body.filesName) {
          await store.remove(Tables.PRODUCTS_IMG, { url_img: 'product.png' });
          try {
            body.filesName.map(async (file) => {
              await store.insert(Tables.PRODUCTS_IMG, {
                id_prod: body.id,
                url_img: file.path,
              });
              OptimizeImg(file.path);
            });
          } catch (error) {
            await store.insert(Tables.PRODUCTS_IMG, {
              id_prod: body.id,
              url_img: body.filesName,
            });
            OptimizeImg(String(body.filesName));
          }
        }

        const imgagesProd = await store.query(Tables.PRODUCTS_IMG, {
          id_prod: body.id,
        });
        const cantImg = imgagesProd.length;
        if (cantImg === 0) {
          await store.insert(Tables.PRODUCTS_IMG, {
            id_prod: body.id,
            url_img: 'product.png',
          });
        }
        return result;
      } else {
        throw new Error();
      }
    } else {
      const result = await store.insert(Tables.PRODUCTS_PRINCIPAL, product);
      if (result.affectedRows > 0) {
        if (body.filesName) {
          try {
            body.filesName.map(async (file) => {
              await store.insert(Tables.PRODUCTS_IMG, {
                id_prod: result.insertId,
                url_img: file.path,
              });
              OptimizeImg(file.path);
            });
          } catch (error) {
            await store.insert(Tables.PRODUCTS_IMG, {
              id_prod: result.insertId,
              url_img: body.filesName,
            });
          }
        } else {
          await store.insert(Tables.PRODUCTS_IMG, {
            id_prod: result.insertId,
            url_img: 'product.png',
          });
        }
        return result;
      }
    }
  };

  const toggleProduct = async (id: number) => {
    const product = await store.get(Tables.PRODUCTS_PRINCIPAL, id);
    if (product[0].enabled === 1) {
      await store.update(Tables.PRODUCTS_PRINCIPAL, { enabled: 0 }, id);
    } else {
      await store.update(Tables.PRODUCTS_PRINCIPAL, { enabled: 1 }, id);
    }
  };

  const remove = async (id_prod: number) => {
    const data: Array<IImgProd> = await store.query(Tables.PRODUCTS_IMG, {
      id_prod: id_prod,
    });
    if (data.length > 0) {
      data.map((url) => {
        if (url.url_img !== 'product.png') {
          const file: string = path.join(
            staticFolders.products,
            url.url_img || '',
          );
          fs.unlinkSync(file);
        }
      });
    }
    await store.remove(Tables.PRODUCTS_IMG, { id_prod: id_prod });
    await store.remove(Tables.PRODUCTS_TAGS, { id_prod: id_prod });
    await store
      .remove(Tables.PRODUCTS_PRINCIPAL, { id: id_prod })
      .then(async (result: any) => {
        if (result.affectedRows > 0) {
          await store.remove(Tables.PRODUCTS_PRINCIPAL, { id: id_prod });
        } else {
          throw new Error();
        }
      });
  };

  const get = async (id: number) => {
    const productGral = await store.get(Tables.PRODUCTS_PRINCIPAL, id);

    const productImg = await store.query(Tables.PRODUCTS_IMG, { id_prod: id });
    const productTags = await store.query(Tables.PRODUCTS_TAGS, {
      id_prod: id,
    });
    return {
      productGral,
      productImg,
      productTags,
    };
  };

  const getPrincipal = async (id: number) => {
    const productGral = await store.get(Tables.PRODUCTS_PRINCIPAL, id);
    return {
      productGral,
    };
  };

  const printPDF = async (
    item?: string,
    advanced?: boolean,
    name?: string,
    provider?: string,
    brand?: string,
  ) => {
    let filter: IWhereParams | undefined = undefined;
    let filters: Array<IWhereParams> = [];
    let conID = false;
    let idProd = 0;
    console.log('item :>> ', item);
    if (advanced) {
      filter = {
        mode: EModeWhere.like,
        concat: EConcatWhere.and,
        items: [
          { column: Columns.prodPrincipal.name, object: String(name) },
          { column: Columns.prodPrincipal.subcategory, object: String(brand) },
          { column: Columns.prodPrincipal.category, object: String(provider) },
          { column: Columns.prodPrincipal.family, object: String(name) },
        ],
      };
      filters.push(filter);
    } else {
      if (item) {
        if (item.includes('id:')) {
          conID = true;
          idProd = Number(item.replace('id:', ''));
        } else {
          const arrayStr = item.split(' ');
          arrayStr.map((subItem) => {
            filter = {
              mode: EModeWhere.like,
              concat: EConcatWhere.or,
              items: [
                { column: Columns.prodPrincipal.name, object: String(subItem) },
                {
                  column: Columns.prodPrincipal.subcategory,
                  object: String(subItem),
                },
                {
                  column: Columns.prodPrincipal.category,
                  object: String(subItem),
                },
                {
                  column: Columns.prodPrincipal.short_decr,
                  object: String(subItem),
                },
                {
                  column: Columns.prodPrincipal.cod_barra,
                  object: String(subItem),
                },
                {
                  column: Columns.prodPrincipal.family,
                  object: String(subItem),
                },
              ],
            };
            filters.push(filter);
          });
        }
      }
    }
    const data = await store.list(
      Tables.PRODUCTS_PRINCIPAL,
      [ESelectFunct.all],
      filters,
      undefined,
      undefined,
      undefined,
    );

    const prodList = await createProdListPDF(data);
    return prodList;
  };

  const getCategory = async () => {
    const groupBy: Array<string> = [Columns.prodPrincipal.category];
    const groupBy2: Array<string> = [Columns.proveedores.fantasia];
    const prov = await store.list(
      Tables.PROVEEDORES,
      [Columns.proveedores.fantasia],
      undefined,
      groupBy2,
      undefined,
      undefined,
    );
    let categories = await store.list(
      Tables.PRODUCTS_PRINCIPAL,
      [Columns.prodPrincipal.category],
      undefined,
      groupBy,
      undefined,
      undefined,
    );
    if (categories.length > 0) {
      let lista: Array<any> = [];
      lista = categories;
      return new Promise((resolve, reject) => {
        if (prov.length > 0) {
          prov.map((item: any, key: number) => {
            const exist = lista.filter(
              (item2) => item2.category === item.fantasia,
            );
            if (exist.length === 0) {
              lista.push({
                category: item.fantasia,
              });
            }
            if (key === prov.length - 1) {
              resolve(lista);
            }
          });
        } else {
          resolve(lista);
        }
      });
    } else {
      let lista: Array<any> = [];
      return new Promise((resolve, reject) => {
        prov.map((item: any, key: number) => {
          lista.push({
            category: item.fantasia,
          });
          if (key === prov.length - 1) {
            resolve(lista);
          }
        });
      });
    }
  };

  const getSubCategory = async () => {
    const order: Iorder = {
      columns: [Columns.prodPrincipal.subcategory],
      asc: true,
    };
    const groupBy: Array<string> = [Columns.prodPrincipal.subcategory];
    return await store.list(
      Tables.PRODUCTS_PRINCIPAL,
      [`DISTINCT ${Columns.prodPrincipal.subcategory}`],
      undefined,
      groupBy,
      undefined,
      undefined,
      order,
    );
  };

  const getFamily = async () => {
    const order: Iorder = {
      columns: [Columns.prodPrincipal.family],
      asc: true,
    };
    const groupBy: Array<string> = [Columns.prodPrincipal.family];
    return await store.list(
      Tables.PRODUCTS_PRINCIPAL,
      [`DISTINCT ${Columns.prodPrincipal.family}`],
      undefined,
      groupBy,
      undefined,
      undefined,
      order,
    );
  };

  const varCost = async (
    aumento: boolean,
    porc: number,
    round: number,
    roundBool: boolean,
    fixAmount: boolean,
    item?: string,
    advanced?: boolean,
    name?: string,
    provider?: string,
    brand?: string,
  ) => {
    let filter: IWhereParams | undefined = undefined;
    let filters: Array<IWhereParams> = [];
    if (advanced) {
      filter = {
        mode: EModeWhere.like,
        concat: EConcatWhere.and,
        items: [
          { column: Columns.prodPrincipal.name, object: String(name) },
          { column: Columns.prodPrincipal.subcategory, object: String(brand) },
          { column: Columns.prodPrincipal.category, object: String(provider) },
          { column: Columns.prodPrincipal.family, object: String(name) },
        ],
      };
      filters.push(filter);
    } else {
      if (item) {
        const arrayStr = item.split(' ');
        arrayStr.map((subItem) => {
          filter = {
            mode: EModeWhere.like,
            concat: EConcatWhere.or,
            items: [
              { column: Columns.prodPrincipal.name, object: String(subItem) },
              {
                column: Columns.prodPrincipal.subcategory,
                object: String(subItem),
              },
              {
                column: Columns.prodPrincipal.category,
                object: String(subItem),
              },
              {
                column: Columns.prodPrincipal.short_decr,
                object: String(subItem),
              },
              {
                column: Columns.prodPrincipal.cod_barra,
                object: String(subItem),
              },
              {
                column: Columns.prodPrincipal.family,
                object: String(subItem),
              },
            ],
          };
          filters.push(filter);
        });
      }
    }

    if (fixAmount) {
      let aumentoFinal = Number(porc);
      if (!aumento) {
        aumentoFinal = -aumentoFinal;
      }

      let roundNumber = 2;
      if (roundBool) {
        roundNumber = round;
      }

      const updateCol: Array<IWhere> = [
        {
          column: Columns.prodPrincipal.precio_compra,
          object: `(ROUND((${Columns.prodPrincipal.precio_compra} + ${aumentoFinal}), ${roundNumber}))`,
        },
        {
          column: Columns.prodPrincipal.vta_price,
          object: `(ROUND(((1 + ${Columns.prodPrincipal.iva}/100) * (1 + ${Columns.prodPrincipal.porc_minor}/100) * (${Columns.prodPrincipal.precio_compra})), ${roundNumber}))`,
        },
      ];

      await store.updateWhere(Tables.PRODUCTS_PRINCIPAL, updateCol, filters);
    } else {
      let aumentoFinal = 1 + Number(porc);
      if (!aumento) {
        aumentoFinal = -aumentoFinal;
      }

      let roundNumber = 2;
      if (roundBool) {
        roundNumber = round;
      }

      const updateCol: Array<IWhere> = [
        {
          column: Columns.prodPrincipal.precio_compra,
          object: `(ROUND((${Columns.prodPrincipal.precio_compra} * ${aumentoFinal}), ${roundNumber}))`,
        },
        {
          column: Columns.prodPrincipal.vta_price,
          object: `(ROUND((${Columns.prodPrincipal.vta_price} * ${aumentoFinal}), ${roundNumber}))`,
        },
      ];

      await store.updateWhere(Tables.PRODUCTS_PRINCIPAL, updateCol, filters);
    }
  };

  const updateList = async (
    marcaUpdate?: string,
    proveedorUpdate?: string,
    costoUpdate?: number,
    ventaUpdate?: number,
    item?: string,
    advanced?: boolean,
    name?: string,
    provider?: string,
    brand?: string,
  ) => {
    let filter: IWhereParams | undefined = undefined;
    let filters: Array<IWhereParams> = [];
    if (advanced) {
      filter = {
        mode: EModeWhere.like,
        concat: EConcatWhere.and,
        items: [
          { column: Columns.prodPrincipal.name, object: String(name) },
          { column: Columns.prodPrincipal.subcategory, object: String(brand) },
          { column: Columns.prodPrincipal.category, object: String(provider) },
          { column: Columns.prodPrincipal.family, object: String(name) },
        ],
      };
      filters.push(filter);
    } else {
      if (item) {
        const arrayStr = item.split(' ');
        arrayStr.map((subItem) => {
          filter = {
            mode: EModeWhere.like,
            concat: EConcatWhere.or,
            items: [
              { column: Columns.prodPrincipal.name, object: String(subItem) },
              {
                column: Columns.prodPrincipal.subcategory,
                object: String(subItem),
              },
              {
                column: Columns.prodPrincipal.category,
                object: String(subItem),
              },
              {
                column: Columns.prodPrincipal.short_decr,
                object: String(subItem),
              },
              {
                column: Columns.prodPrincipal.cod_barra,
                object: String(subItem),
              },
              {
                column: Columns.prodPrincipal.family,
                object: String(subItem),
              },
            ],
          };
          filters.push(filter);
        });
      }
    }

    if (costoUpdate) {
      const updateCol: Array<IWhere> = [
        {
          column: Columns.prodPrincipal.precio_compra,
          object: `(ROUND((${costoUpdate}), 2))`,
        },
      ];

      await store.updateWhere(Tables.PRODUCTS_PRINCIPAL, updateCol, filters);
    }
    if (ventaUpdate) {
      const updateCol: Array<IWhere> = [
        {
          column: Columns.prodPrincipal.vta_price,
          object: `(ROUND((${ventaUpdate}), 2))`,
        },
      ];

      await store.updateWhere(Tables.PRODUCTS_PRINCIPAL, updateCol, filters);
    }
    if (marcaUpdate) {
      const updateCol: Array<IWhere> = [
        {
          column: Columns.prodPrincipal.subcategory,
          object: `'${marcaUpdate}'`,
        },
      ];

      await store.updateWhere(Tables.PRODUCTS_PRINCIPAL, updateCol, filters);
    }
    if (proveedorUpdate) {
      const updateCol: Array<IWhere> = [
        {
          column: Columns.prodPrincipal.category,
          object: `'${proveedorUpdate}'`,
        },
      ];

      await store.updateWhere(Tables.PRODUCTS_PRINCIPAL, updateCol, filters);
    }

    if (costoUpdate || ventaUpdate) {
      const compraConIva = `(${Columns.prodPrincipal.precio_compra} * (1 + ${Columns.prodPrincipal.iva}/100))`;
      const ganancia = `(${Columns.prodPrincipal.vta_price} - ${compraConIva})`;
      const porcGanancia = `(${ganancia} / ${compraConIva}) * 100`;
      const updateCol: Array<IWhere> = [
        {
          column: Columns.prodPrincipal.porc_minor,
          object: `(ROUND(( ${porcGanancia}), 0))`,
        },
      ];

      await store.updateWhere(Tables.PRODUCTS_PRINCIPAL, updateCol, filters);
    }

    return '';
  };

  const aplicatePorcGan = async (porc: number, item?: string) => {
    let filter: IWhereParams | undefined = undefined;
    let filters: Array<IWhereParams> = [];
    if (item) {
      filter = {
        mode: EModeWhere.like,
        concat: EConcatWhere.or,
        items: [
          { column: Columns.prodPrincipal.name, object: String(item) },
          { column: Columns.prodPrincipal.subcategory, object: String(item) },
          { column: Columns.prodPrincipal.category, object: String(item) },
          { column: Columns.prodPrincipal.short_decr, object: String(item) },
          { column: Columns.prodPrincipal.cod_barra, object: String(item) },
          { column: Columns.prodPrincipal.family, object: String(item) },
        ],
      };
      filters.push(filter);
    }

    const updateCol: Array<IWhere> = [
      {
        column: Columns.prodPrincipal.porc_minor,
        object: String(porc),
      },
    ];

    const updateCol2: Array<IWhere> = [
      {
        column: Columns.prodPrincipal.vta_price,
        object: `ROUND((${Columns.prodPrincipal.precio_compra} * (1 + (${
          Columns.prodPrincipal.iva
        }/100)) * ${porc / 100 + 1}), 2)`,
      },
      {
        column: Columns.prodPrincipal.round,
        object: `0`,
      },
    ];

    await store.updateWhere(Tables.PRODUCTS_PRINCIPAL, updateCol2, filters);

    await store.updateWhere(Tables.PRODUCTS_PRINCIPAL, updateCol, filters);
  };

  const asignarCodBarra = async (id: number, codBarras: string) => {
    return await store.update(
      Tables.PRODUCTS_PRINCIPAL,
      { cod_barra: codBarras },
      id,
    );
  };

  const updateCost = async (idProd: number, cost: number) => {
    return await store.update(
      Tables.PRODUCTS_PRINCIPAL,
      { precio_compra: cost },
      idProd,
    );
  };

  return {
    list,
    upsert,
    remove,
    get,
    getCategory,
    getSubCategory,
    varCost,
    aplicatePorcGan,
    getPrincipal,
    asignarCodBarra,
    updateCost,
    printPDF,
    updateList,
    getFamily,
    publicList,
    toggleProduct,
  };
};
