# Propuesta: IVA discriminado sin sumar al precio

## Objetivo

Cambiar el criterio actual de facturacion con IVA para que el IVA no se agregue por encima del precio de venta del producto.

El precio cargado en el producto debe tomarse como precio final de venta. Cuando corresponda discriminar IVA, el sistema debe separar ese total en neto gravado e IVA incluido, usando la alicuota configurada en cada producto.

## Criterio nuevo

Para facturas fiscales A, B o M emitidas desde un punto de venta Responsable Inscripto:

- El precio de venta del producto es el total final.
- El IVA no se suma al precio.
- El IVA se discrimina hacia adentro del precio final.
- La alicuota sale del campo `iva` del producto.
- El `alicuota_id` fiscal debe calcularse segun esa alicuota.

Ejemplo con producto de $100 e IVA 21%:

| Concepto | Importe |
| -------- | ------: |
| Total producto | $100,00 |
| Neto gravado | $82,64 |
| IVA 21% incluido | $17,36 |
| Total facturado | $100,00 |

Formula:

```txt
total = precio_venta * cantidad * (1 - descuento_item / 100)
neto = total / (1 + iva_producto / 100)
iva = total - neto
```

## Diferencia con el comportamiento actual

Hoy el sistema hace esto:

```txt
neto = precio_venta * cantidad
iva = neto * 21%
total = neto + iva
```

Con la nueva regla debe hacer esto:

```txt
total = precio_venta * cantidad
neto = total / (1 + iva_producto / 100)
iva = total - neto
```

## Backend

### Archivo principal

`src/utils/facturacion/middleFactu.ts`

Actualmente `calcProdLista` fija:

```ts
const ivaAlicuota = aplicaIva ? 21 : 0;
const alicuotaId = aplicaIva ? 5 : 0;
```

Y calcula:

```ts
const totalNeto = dataProd[0].vta_price * prod.cant_prod * (1 - descuentoPorcentaje / 100);
const totalIva = totalNeto * (ivaAlicuota / 100);
const totalProd = totalNeto + totalIva;
```

Debe pasar a:

```ts
const ivaAlicuota = aplicaIva ? Number(dataProd[0].iva) || 0 : 0;
const alicuotaId = aplicaIva ? getAlicuotaId(ivaAlicuota) : 0;

const totalProd =
  dataProd[0].vta_price *
  prod.cant_prod *
  (1 - descuentoPorcentaje / 100);

const totalNeto =
  aplicaIva && ivaAlicuota > 0
    ? totalProd / (1 + ivaAlicuota / 100)
    : totalProd;

const totalIva = aplicaIva ? totalProd - totalNeto : 0;
```

El acumulado de `totalFact` debe sumar `totalProd`, no `totalNeto + totalIva` por una adicion externa. En la practica ambos coinciden con la formula nueva, pero semanticamente `totalProd` es el precio final.

### Mapeo de alicuotas

El backend ya tiene `perIvaAlicuotas` en `src/utils/facturacion/AfipClass.ts`.

Se puede resolver el ID asi:

```ts
const getAlicuotaId = (iva: number): AlicuotasIva => {
  return perIvaAlicuotas.find((item) => Number(item.per) === Number(iva))?.id || 3;
};
```

Si el producto tiene una alicuota no contemplada por AFIP, conviene fallar con error claro antes de facturar, en vez de mandar un ID incorrecto.

### Lista de IVA para AFIP

`listaIva` ya agrupa por `alicuota_id`, pero tiene un detalle a corregir:

```ts
ivaAnt = 5;
```

Eso queda mal si hay productos con alicuotas distintas. Debe ser:

```ts
ivaAnt = iva;
```

Esto es necesario para que una factura con productos al 21%, 10.5%, 27%, etc. informe bien cada base imponible e importe de IVA.

### Totales de factura

Con el nuevo criterio:

- `total_fact`: total final cobrado.
- `total_neto`: suma de netos discriminados.
- `total_iva`: suma de IVA incluido.
- `total_compra`: sin cambios.

Ejemplo:

| Producto | Precio final | IVA producto | Neto | IVA | Total |
| -------- | -----------: | -----------: | ---: | --: | ----: |
| A | $100,00 | 21% | $82,64 | $17,36 | $100,00 |
| B | $100,00 | 10.5% | $90,50 | $9,50 | $100,00 |
| Total | $200,00 | - | $173,14 | $26,86 | $200,00 |

### PDF de factura

`src/utils/facturacion/middlePDFinvoice.ts`

Hay fallback con `1.21` y alicuota fija `21`:

```ts
totalFact / 1.21
totalItem / 1.21
alicuota_porcentaje: 21
```

Debe evitarse usar 21 fijo. Lo ideal es que el PDF use los valores guardados en `detalles_fact`:

- `item.total_neto`
- `item.total_iva`
- `item.alicuota_id`

Y derive el porcentaje desde `perIvaAlicuotas` solo para mostrarlo:

```ts
const alicuotaPorcentaje =
  perIvaAlicuotas.find((iva) => iva.id === item.alicuota_id)?.per || 0;
```

El fallback historico con `1.21` puede quedar solo para comprobantes viejos, pero no debe aplicarse a facturas nuevas con alicuota por producto.

### Template PDF

`views/invoices/Factura.ejs`

Actualmente muestra:

```ejs
IVA 21%: <%- formatoPrecio(totalIva) %>
```

Debe cambiar a un texto generico:

```txt
IVA: $...
```

O, si se quiere mayor detalle, mostrar un resumen por alicuota:

```txt
IVA 21%: ...
IVA 10.5%: ...
IVA 27%: ...
```

Para eso habria que enviar desde el middleware una lista agrupada para impresion.

## Frontend

### Pantalla de venta

`src/views/admin/ventas/components/vender/index.js`

Hoy calcula:

```js
const totalAntesDescuento = aplicaIva ? totalPrecio * 1.21 : totalPrecio;
const totalIva = aplicaIva ? netoGravado * 0.21 : 0;
```

Debe cambiar a:

```js
const totalAntesDescuento = totalPrecio;
```

Y el IVA debe calcularse producto por producto desde `item.iva`, discriminando hacia adentro del precio final:

```js
const totalItemFinal =
  item.vta_price * item.cant_prod * (1 - item.descuento_porcentaje / 100);

const netoItem =
  aplicaIva && Number(item.iva) > 0
    ? totalItemFinal / (1 + Number(item.iva) / 100)
    : totalItemFinal;

const ivaItem = aplicaIva ? totalItemFinal - netoItem : 0;
```

Los pagos deben seguir validando contra el total final con descuento general, pero ese total ya no debe incluir `* 1.21`.

### Fila de producto

`src/components/subComponents/Listados/SubComponentes/FilaProdSell.js`

Actualmente hace:

```js
const totalItemNeto = precioUnitarioFinal * item.cant_prod;
const totalItemIva = aplicaIva ? totalItemNeto * 0.21 : 0;
const totalItemFinal = totalItemNeto + totalItemIva;
```

Debe pasar a:

```js
const totalItemFinal = precioUnitarioFinal * item.cant_prod;
const ivaPorcentaje = Number(item.iva) || 0;
const totalItemNeto =
  aplicaIva && ivaPorcentaje > 0
    ? totalItemFinal / (1 + ivaPorcentaje / 100)
    : totalItemFinal;
const totalItemIva = aplicaIva ? totalItemFinal - totalItemNeto : 0;
```

La columna de IVA deberia mostrar tambien la alicuota, por ejemplo:

```txt
$17,36 (21%)
```

### Lista de productos de venta

`src/views/admin/ventas/components/vender/list/prodListSell.js`

El total del carrito puede seguir siendo:

```js
item.vta_price * cantidad * descuento
```

Porque ahora ese valor representa el total final. No debe multiplicarse luego por 1.21.

### Modal de pagos

`src/views/admin/ventas/components/vender/formasPago/index.js`
`src/views/admin/ventas/components/vender/formasPago/modalPago.js`

No deberian necesitar una formula especial de IVA. Deben recibir `totalPrecio` como total final antes de descuento general y aplicar solo:

```js
totalPrecio - totalPrecio * (descuentoPerc / 100)
```

El cambio importante es que desde `vender/index.js` ya no se les pase un total inflado con `* 1.21`.

## Devoluciones y notas de credito

`src/utils/facturacion/middleDevFact.ts`

La devolucion parcial usa los valores guardados en la factura original:

- `total_prod`
- `total_neto`
- `total_iva`
- `alicuota_id`

Con eso deberia seguir funcionando bien para facturas nuevas. Igual hay que revisar el agrupado de IVA porque tambien aparece una asignacion fija:

```ts
ivaAnt = 5;
```

Debe corregirse igual que en `middleFactu.ts`:

```ts
ivaAnt = iva;
```

## Documentacion existente

`DOCUMENTACION_FACTURACION_IVA.md` describe el comportamiento anterior: precio neto + IVA 21%.

Hay que actualizarla o reemplazarla para que diga:

- El precio cargado en el producto es precio final.
- El IVA se discrimina, no se suma.
- La alicuota sale del producto.
- Los comprobantes A, B y M muestran neto e IVA incluidos en el total.
- Los pagos coinciden con el precio final, no con precio + IVA.

## Resultado esperado

Producto con precio de venta $100, cantidad 1, IVA 21%, factura fiscal A:

| Campo | Valor |
| ----- | ----: |
| Total a cobrar | $100,00 |
| Neto gravado | $82,64 |
| IVA incluido | $17,36 |
| Total AFIP | $100,00 |

Producto con precio de venta $100, cantidad 1, IVA 10.5%, factura fiscal A:

| Campo | Valor |
| ----- | ----: |
| Total a cobrar | $100,00 |
| Neto gravado | $90,50 |
| IVA incluido | $9,50 |
| Total AFIP | $100,00 |

Venta no fiscal o comprobante no alcanzado:

| Campo | Valor |
| ----- | ----: |
| Total a cobrar | precio final |
| Neto | precio final |
| IVA | $0,00 |

## Pruebas necesarias

1. Factura A con producto IVA 21%.
2. Factura A con producto IVA 10.5%.
3. Factura A con productos de distintas alicuotas.
4. Factura B con IVA discriminado internamente.
5. Factura M con IVA discriminado internamente.
6. Factura C o venta no fiscal, sin IVA.
7. Venta con descuento por item.
8. Venta con descuento general.
9. Pagos multiples igualando el total final.
10. Nota de credito o devolucion parcial de una factura con varias alicuotas.

## Archivos a tocar

Backend:

- `src/utils/facturacion/middleFactu.ts`
- `src/utils/facturacion/middlePDFinvoice.ts`
- `src/utils/facturacion/middleDevFact.ts`
- `views/invoices/Factura.ejs`
- `DOCUMENTACION_FACTURACION_IVA.md`

Frontend:

- `src/views/admin/ventas/components/vender/index.js`
- `src/components/subComponents/Listados/SubComponentes/FilaProdSell.js`
- `src/views/admin/ventas/components/vender/list/prodListSell.js`

Posibles adicionales si aparecen referencias fijas a 21% durante la implementacion:

- `src/views/admin/ventas/components/vender/formasPago/index.js`
- `src/views/admin/ventas/components/vender/formasPago/modalPago.js`

## Nota de implementacion

La fuente de verdad debe ser el backend. El frontend solo debe previsualizar los mismos numeros para que el usuario vea cuanto cobra, cuanto es neto y cuanto IVA se discrimina.

Aunque el frontend calcule el desglose para mostrarlo, el backend debe volver a calcular todo con los datos reales del producto en base de datos antes de emitir la factura.
