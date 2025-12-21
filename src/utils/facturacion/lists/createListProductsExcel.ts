import fs from 'fs';
import moment from 'moment';
import path from 'path';
export const createProdListCSV = async (prodList: Array<any>) => {
  return new Promise(async (resolve, reject) => {
    const dateNow = moment(new Date()).format('YYYYMMDD_HHmmss');

    const fileName = `prodList-${dateNow}.csv`;
    const location = path.join('public', 'prod-list', fileName);

    let csvContent = '';
    csvContent +=
      'ID;CODIGO;NOMBRE;PROVEEDOR;MARCA;FAMILIA;COSTO;PRECIO DE VENTA\n';

    prodList.forEach((item) => {
      const row = `${item.id};${item.cod_barra};${item.name};${item.category};${item.subcategory};${item.family};${item.precio_compra};${item.vta_price}\n`;
      csvContent += row;
    });

    fs.writeFile(location, csvContent, 'utf8', function (err) {
      if (err) {
        reject('Some error occurred - file either not saved or corrupted.');
      } else {
        resolve({
          fileName: fileName,
          filePath: location,
        });
      }
    });
  });
};
