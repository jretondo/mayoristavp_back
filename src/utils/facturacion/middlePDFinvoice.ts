import { NextFunction, Request, Response } from 'express';
import { INewPV } from 'interfaces/Irequests';
import { IDetFactura, IFactura, IFormasPago } from 'interfaces/Itables';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import utf8 from 'utf8';
import base64 from 'base-64';
import ejs from 'ejs';
import { zfill } from '../cerosIzq';
import moment from 'moment';
import {
  CbteTipos,
  condFiscalIva,
  FactInscriptoProd,
  FactInscriptoServ,
  FactMonotribProd,
  FactMonotribServ,
  perIvaAlicuotas,
} from './AfipClass';
import puppeteer from 'puppeteer';

export const invoicePDFMiddle = () => {
  const middleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const pvData: INewPV = req.body.pvData;
      const noPrice: boolean = Boolean(req.query.noPrice);
      const newFact: IFactura = req.body.newFact;
      const orderId = req.body.orderId;
      let productsList: Array<IDetFactura> = req.body.productsList;
      productsList.map((item) => {
        return {
          ...item,
          cant_prod: Number(item.cant_prod),
        };
      });
      let variosPagos: { tipo: Number }[] = [];
      try {
        variosPagos = req.body.variosPagos.map((pago: IFormasPago) => {
          if (pago.tipo === 4) {
            return {
              tipo: pago.tipo,
            };
          } else {
            return {
              tipo: 1,
            };
          }
        });

        variosPagos = variosPagos.filter(
          (item, index) =>
            variosPagos.findIndex((t) => t.tipo === item.tipo) === index,
        );
      } catch (error) {}
      const dataFiscal:
        | FactInscriptoProd
        | FactInscriptoServ
        | FactMonotribProd
        | FactMonotribServ
        | any = req.body.dataFiscal;

      let urlQr = '';
      function base64_encode(file: any) {
        // read binary data
        var bitmap: Buffer = fs.readFileSync(file);
        // convert binary data to base64 encoded string
        return Buffer.from(bitmap).toString('base64');
      }
      const pvStr = zfill(newFact.pv, 5);
      const nroStr = zfill(newFact.cbte, 8);
      const logo64 = base64_encode(
        path.join('public', 'images', 'invoices', 'logo.png'),
      );
      let encabezado = {
        factNro: pvStr + '-' + nroStr,
        fechaFact: moment(newFact.fecha, 'YYYY-MM-DD').format('DD/MM/YYYY'),
        letra: newFact.letra,
        codFact: 'NO VÁLIDO COMO COMPROBANTE FISCAL',
      };
      let cbteAsoc = false || '';

      let footer = {
        logo: 'data:image/png;base64,' + logo64,
        logoAfip1: '',
        logoAfip2: '',
        codQR: '',
        caeNro: '',
        caeVto: '',
        vendedor: newFact.seller_name || '',
      };

      if (newFact.fiscal) {
        const factData = {
          ver: 1,
          fecha: newFact.fecha,
          cuit: pvData.cuit,
          ptoVta: pvData.pv,
          tipoCmp: newFact.t_fact,
          nroCmp: newFact.cbte,
          importe: newFact.total_fact,
          moneda: 'PES',
          ctz: 0,
          tipoDocRec: newFact.tipo_doc_cliente,
          nroDocRec: newFact.n_doc_cliente,
          tipoCodAut: 'E',
          codAut: newFact.cae,
        };

        const factDataStr = JSON.stringify(factData);
        var text = factDataStr;
        var bytes = utf8.encode(text);
        var encoded = base64.encode(bytes);
        const paraAfip = 'https://www.afip.gob.ar/fe/qr/?p=' + encoded;

        const lAfip1 = base64_encode(
          path.join('public', 'images', 'invoices', 'AFIP1.png'),
        );
        const lAfip2 = base64_encode(
          path.join('public', 'images', 'invoices', 'AFIP2.png'),
        );

        urlQr = await new Promise((resolve, reject) => {
          QRCode.toDataURL(paraAfip, function (err, url) {
            if (err) {
              throw new Error('Algo salio mal');
            }
            resolve(url);
          });
        });
        encabezado = {
          factNro: pvStr + '-' + nroStr,
          fechaFact: moment(newFact.fecha, 'YYYY-MM-DD').format('DD/MM/YYYY'),
          letra: newFact.letra,
          codFact: zfill(dataFiscal.CbteTipo, 2),
        };
        if (
          dataFiscal.CbteTipo === CbteTipos['Nota de Crédito A'] ||
          dataFiscal.CbteTipo === CbteTipos['Nota de Crédito B'] ||
          dataFiscal.CbteTipo === CbteTipos['Nota de Crédito C'] ||
          dataFiscal.CbteTipo === CbteTipos['Nota de Crédito M']
        ) {
          const cbteAsocObj = dataFiscal.CbtesAsoc.CbtesAsoc || [
            { PtoVta: 0 },
            { Nro: 0 },
          ];
          cbteAsoc =
            `${zfill(cbteAsocObj[0].PtoVta || 0, 5)} - ${zfill(
              cbteAsocObj[0].Nro || 0,
              8,
            )}` || '';
        }

        footer = {
          logo: 'data:image/png;base64,' + logo64,
          logoAfip1: 'data:image/png;base64,' + lAfip1,
          logoAfip2: 'data:image/png;base64,' + lAfip2,
          codQR: urlQr,
          caeNro: dataFiscal.CAE || '',
          caeVto: moment(dataFiscal.CAEFchVto, 'YYYY-MM-DD').format(
            'DD/MM/YYYY',
          ),
          vendedor: newFact.seller_name,
        };
      }

      const myCss = fs.readFileSync(
        path.join('public', 'css', 'style.css'),
        'utf8',
      );

      let condIvaStr = '';
      let condIvaStrCliente = '';

      if (pvData.cond_iva === condFiscalIva['IVA Responsable Inscripto']) {
        condIvaStr = 'IVA Responsable Inscripto';
      } else if (pvData.cond_iva === condFiscalIva['IVA Sujeto Exento']) {
        condIvaStr = 'IVA Sujeto Exento';
      } else if (pvData.cond_iva === condFiscalIva['Responsable Monotributo']) {
        condIvaStr = 'Responsable Monotributo';
      }

      if (
        newFact.cond_iva_cliente === condFiscalIva['IVA Responsable Inscripto']
      ) {
        condIvaStrCliente = 'IVA Responsable Inscripto';
      } else if (
        newFact.cond_iva_cliente === condFiscalIva['IVA Sujeto Exento']
      ) {
        condIvaStrCliente = 'IVA Sujeto Exento';
      } else if (
        newFact.cond_iva_cliente === condFiscalIva['Responsable Monotributo']
      ) {
        condIvaStrCliente = 'Responsable Monotributo';
      } else if (
        newFact.cond_iva_cliente === condFiscalIva['Consumidor Final']
      ) {
        condIvaStrCliente = 'Consumidor Final';
      }

      const ptoVta = {
        razSocOrigen: pvData.raz_soc,
        direccionOrigen: pvData.direccion,
        condIvaOrigen: condIvaStr,
        emailOrigen: pvData.email,
        cuitOrigen: pvData.cuit,
        iibbOrigen: pvData.iibb,
        iniAct: moment(pvData.ini_act, 'YYYY-MM-DD').format('DD/MM/YYYY'),
      };
      const cliente = {
        clienteEmail: newFact.email_cliente || '',
        clienteName: newFact.raz_soc_cliente || 'Consumidor Final',
        clienteNro: newFact.n_doc_cliente || '',
        tipoDoc:
          newFact.tipo_doc_cliente === 80
            ? 'CUIT'
            : newFact.tipo_doc_cliente === 96
              ? 'DNI'
              : '',
        condIvaCliente: condIvaStrCliente.toUpperCase(),
        direccionCliente: newFact.direccion_entrega || '',
        telefonoCliente: newFact.telefono || '',
        localidadCliente: newFact.localidad || '',
        provinciaCliente: newFact.provincia || '',
      };

      const totalFact = Math.abs(Number(newFact.total_fact) || 0);
      const totalDesc = Math.abs(Number(newFact.descuento) || 0);
      const tipoComprobante = Number(newFact.t_fact);
      const discriminaIva =
        Boolean(Number(newFact.fiscal)) &&
        Number(pvData.cond_iva) ===
          condFiscalIva['IVA Responsable Inscripto'] &&
        [
          CbteTipos['Factura A'],
          CbteTipos['Factura B'],
          CbteTipos['Factura M'],
        ].includes(tipoComprobante);
      const totalIvaGuardado = Math.abs(Number(newFact.total_iva) || 0);
      const totalNetoGuardado = Math.abs(Number(newFact.total_neto) || 0);
      const tieneDesgloseGuardado =
        totalIvaGuardado > 0 &&
        Math.abs(totalNetoGuardado + totalIvaGuardado - totalFact) < 0.02;
      const totalNeto =
        discriminaIva && !tieneDesgloseGuardado
          ? Math.round((totalFact / 1.21) * 100) / 100
          : totalNetoGuardado;
      const totalIva =
        discriminaIva && !tieneDesgloseGuardado
          ? Math.round((totalFact - totalNeto) * 100) / 100
          : totalIvaGuardado;
      const totales = {
        subTotal: totalNeto + totalDesc,
        subTotalNoFiscal: totalNeto + totalIva + totalDesc,
        netoGravado: totalNeto,
        totalIva,
        totalFact,
        totalDesc,
        discriminaIva,
      };
      let formapagoStr = '';
      switch (newFact.forma_pago) {
        case 0:
          formapagoStr = 'EFECTIVO';
          break;
        case 1:
          formapagoStr = 'MERCADO PAGO';
          break;
        case 2:
          formapagoStr = 'DEBITO';
          break;
        case 3:
          formapagoStr = 'CREDITO';
          break;
        case 4:
          formapagoStr = 'CUENTA CORRIENTE';
          break;
        case 6:
          formapagoStr = 'CHEQUE';
          break;
        case 7:
          formapagoStr = 'TRANSFERENCIA';
          break;
        default:
          formapagoStr = 'OTROS';
          break;
      }

      const formaPago = {
        string: formapagoStr,
        code: newFact.forma_pago,
      };
      const listaItems = productsList.map((item) => {
        if (!discriminaIva) {
          return item;
        }

        const cantidad = Math.abs(Number(item.cant_prod) || 0);
        const totalItem = Math.abs(Number(item.total_prod) || 0);
        const precioUnitario = Math.abs(Number(item.precio_ind) || 0);
        const netoGuardado = Math.abs(Number(item.total_neto) || 0);
        const ivaGuardado = Math.abs(Number(item.total_iva) || 0);
        const alicuotaPorcentaje = getAlicuotaPorcentaje(item.alicuota_id);
        const descuentoItem = Math.abs(
          Number(item.descuento_porcentaje) || 0,
        );
        const tieneDesgloseItem =
          ivaGuardado > 0 &&
          Math.abs(netoGuardado + ivaGuardado - totalItem) < 0.02;
        const netoItem = tieneDesgloseItem
          ? netoGuardado
          : Math.round(
              (totalItem / (1 + alicuotaPorcentaje / 100)) * 100,
            ) / 100;
        const ivaItem = tieneDesgloseItem
          ? ivaGuardado
          : Math.round((totalItem - netoItem) * 100) / 100;
        const netoUnitario = cantidad > 0 ? netoItem / cantidad : 0;
        const precioGuardadoEsNeto =
          tieneDesgloseItem &&
          precioUnitario > 0 &&
          Math.abs(
            precioUnitario * (1 - descuentoItem / 100) - netoUnitario,
          ) < 0.02;

        return {
          ...item,
          precio_neto:
            precioGuardadoEsNeto
              ? precioUnitario
              : precioUnitario > 0
                ? Math.round(
                    (precioUnitario / (1 + alicuotaPorcentaje / 100)) * 100,
                  ) / 100
                : cantidad > 0
                  ? Math.round(netoUnitario * 100) / 100
                  : 0,
          total_neto: netoItem,
          total_iva: ivaItem,
          alicuota_porcentaje: alicuotaPorcentaje,
        };
      });

      const maxItemsPorPagina = 35;
      const paginasItems = dividirEnPaginas(listaItems, maxItemsPorPagina);
      const datos2 = {
        myCss: `<style>${myCss}</style>`,
        listaItems,
        cbteAsoc,
        formaPago,
        variosPagos,
        noPrice,
        ...encabezado,
        ...ptoVta,
        ...cliente,
        ...totales,
        ...footer,
        paginasItems: paginasItems,
        totalPaginas: paginasItems.length,
        orderId,
      };

      let ejsPath = 'Factura.ejs';
      if (!newFact.fiscal) {
        ejsPath = 'FacturaNoFiscal.ejs';
      }

      ejs.renderFile(
        path.join('views', 'invoices', ejsPath),
        datos2,
        async (err, data) => {
          if (err) {
            console.log('err', err);
            throw new Error('Algo salio mal');
          }

          const fileName = newFact.letra + ' ' + pvStr + '-' + nroStr + '.pdf';
          const filePath = path.join('public', 'invoices', fileName);
          req.body.fileName = fileName;
          req.body.filePath = filePath;
          req.body.formapagoStr = formapagoStr;

          const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath:
              process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
          });
          const page = await browser.newPage();
          await page.setContent(data, { waitUntil: 'networkidle0' });
          await page.pdf({
            path: filePath,
            format: 'A4',
            landscape: false,
            scale: 1,
            displayHeaderFooter: false,

            margin: {
              top: '0.5cm',
              bottom: '0.5cm',
            },
          });
          await browser.close();
          next();
        },
      );
    } catch (error) {
      console.error(error);
      next(new Error('Faltan datos o hay datos erroneos, controlelo!'));
    }
  };
  return middleware;
};

function dividirEnPaginas(items: IDetFactura[], maxItemsPorPagina: number) {
  const paginas = [];
  for (let i = 0; i < items.length; i += maxItemsPorPagina) {
    paginas.push(items.slice(i, i + maxItemsPorPagina));
  }
  return paginas;
}

const getAlicuotaPorcentaje = (alicuotaId: number): number => {
  return (
    perIvaAlicuotas.find((item) => Number(item.id) === Number(alicuotaId))
      ?.per || 0
  );
};
