import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { IMovCtaCte } from 'interfaces/Itables';
import ControllerUsers from '../../../api/components/user';
import moment from 'moment';
import { formatMoney } from '../../formatMoney';
import { zfill } from '../../cerosIzq';
import puppeteer from 'puppeteer';
import { roundNumber } from '../../roundNumb';

export const createListCtaCtePDF = async (
  desde: string,
  hasta: string,
  total: number,
  data: Array<IMovCtaCte>,
  filtro?: string,
) => {
  return new Promise(async (resolve, reject) => {
    function base64_encode(file: any) {
      // read binary data
      var bitmap: Buffer = fs.readFileSync(file);
      // convert binary data to base64 encoded string
      return Buffer.from(bitmap).toString('base64');
    }

    const desdeStr = moment(desde, 'YYYY-MM-DD').format('DD/MM/YYYY');
    const hastaStr = moment(hasta, 'YYYY-MM-DD').format('DD/MM/YYYY');

    const estilo = fs.readFileSync(
      path.join('views', 'reports', 'cajaList', 'styles.css'),
      'utf8',
    );
    const logo = base64_encode(
      path.join('public', 'images', 'invoices', 'logo.png'),
    );

    const fileName = `CtaCte - desde ${desde} al ${hasta}.pdf`;
    const location = path.join('public', 'caja-lists', fileName);

    const listaVtas: Array<{
      fecha: string;
      cliente: string;
      factura: string;
      totalStr: number;
    }> = [];

    for (let i = 0; i < data.length; i++) {
      const current = data[i];
      const fecha = moment(current.fecha).format('DD/MM/YYYY HH:mm') + ' hs';
      const clienteName = current.razsoc;
      let cliente = '';
      if (clienteName === '') {
        cliente = 'Consumidor Final';
      } else {
        cliente = `${clienteName} (${current.cuit ? 'CUIT: ' : 'DNI: '} ${
          current.ndoc
        })`;
      }
      const factura = `${current.letra} ${zfill(current.pv || 0, 5)} - ${zfill(
        current.cbte || 0,
        8,
      )}`;

      const importe = roundNumber(current.importe);

      listaVtas.push({
        fecha: fecha,
        cliente: cliente,
        factura: factura,
        totalStr: importe || 0,
      });
    }
    const datos = {
      logo: 'data:image/png;base64,' + logo,
      style: '<style>' + estilo + '</style>',
      desdeStr: desdeStr,
      hastaStr: hastaStr,
      listaVtas: listaVtas,
      total: roundNumber(total),
      filtro,
    };

    await ejs.renderFile(
      path.join('views', 'reports', 'ctacteList', 'index.ejs'),
      datos,
      async (err, data) => {
        if (err) {
          console.log('err', err);
          throw new Error('Algo salio mal');
        }

        const browser = await puppeteer.launch({
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          executablePath:
            process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        });

        const page = await browser.newPage();
        await page.setContent(data, {
          waitUntil: 'networkidle0',
        });

        await page.pdf({
          path: location,
          format: 'A4',
          landscape: true,
          scale: 0.8,
          displayHeaderFooter: true,
          margin: {
            top: '0.5cm',
            bottom: '2cm',
          },
          footerTemplate:
            "<div style='font-size: 14px; text-align: center; width: 100%;'>Página&nbsp;<span class='pageNumber'></span>&nbsp;de&nbsp;<span class='totalPages'></span></div>",
          headerTemplate: '<div></div>',
        });
        await browser.close();

        const dataFact = {
          filePath: location,
          fileName: fileName,
        };

        return resolve(dataFact);
      },
    );
  });
};
