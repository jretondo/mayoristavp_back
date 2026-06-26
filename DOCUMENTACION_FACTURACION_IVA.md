# Documentacion de facturacion e IVA

## Definicion vigente

El precio de venta cargado en el producto se toma como precio final.

Cuando corresponde discriminar IVA, el sistema no suma IVA por encima del precio. El sistema separa el precio final en neto gravado e IVA incluido, usando la alicuota configurada en cada producto.

## Comprobantes alcanzados

La discriminacion de IVA aplica cuando se cumplen estas condiciones:

1. La venta es fiscal.
2. El punto de venta es Responsable Inscripto.
3. El comprobante es Factura A, Factura B o Factura M.

En esos casos:

| Campo | Como se calcula |
| ----- | --------------- |
| Total | Precio final del producto, menos descuentos si corresponde |
| Neto gravado | Total / (1 + alicuota IVA producto / 100) |
| IVA | Total - neto gravado |

## Ejemplo 21%

Producto con precio final de $100 e IVA 21%:

| Concepto | Importe |
| -------- | ------: |
| Total producto | $100,00 |
| Neto gravado | $82,64 |
| IVA incluido | $17,36 |
| Total facturado | $100,00 |

## Ejemplo 10.5%

Producto con precio final de $100 e IVA 10.5%:

| Concepto | Importe |
| -------- | ------: |
| Total producto | $100,00 |
| Neto gravado | $90,50 |
| IVA incluido | $9,50 |
| Total facturado | $100,00 |

## Comprobantes no alcanzados

Cuando la venta no entra en los casos anteriores, el sistema no discrimina IVA.

Por ejemplo:

- Venta no fiscal.
- Comprobante X.
- Factura C.
- Punto de venta no Responsable Inscripto.

En esos casos, el precio del producto se usa como total de la venta y el IVA queda en cero.

## Descuentos

Los descuentos por producto afectan primero al total del item. Si corresponde discriminar IVA, el neto y el IVA se calculan sobre ese total descontado.

El descuento general afecta al total de la operacion y tambien reduce proporcionalmente el neto gravado y el IVA informado.

## Pagos

El sistema valida que la suma de los pagos coincida con el total final de la factura.

Si el producto vale $100 y corresponde discriminar IVA, el pago debe cubrir $100, no $121.

## Comprobante fiscal

Para facturas A, B y M alcanzadas, el comprobante informa:

- Neto gravado.
- IVA incluido.
- Total final.

La alicuota de cada producto sale del campo `iva` del producto y se informa a AFIP con el `alicuota_id` correspondiente.

## Resumen simple

Si una factura fiscal A, B o M tiene un producto de $100 con IVA 21%:

| Concepto | Importe |
| -------- | ------: |
| Neto gravado | $82,64 |
| IVA incluido | $17,36 |
| Total a cobrar | $100,00 |

El IVA se discrimina, no se suma.
