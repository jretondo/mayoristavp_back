# Changelog

## [1.0.1] - 2026-06-26

### Changed
- Cambia el calculo de IVA para discriminarlo dentro del precio final del producto usando la alicuota configurada por producto.
- Actualiza el PDF fiscal para mostrar IVA discriminado sin fijar el texto a 21%.
- Mejora el flujo de Factura C y notas de credito fiscales evitando enviar `Iva` cuando no corresponde.

### Fixed
- Corrige el tipo y numero de documento enviados a AFIP para clientes CUIT, DNI y consumidor final.
- Corrige agrupacion de IVA por alicuota en facturacion y devoluciones.
- Agrega logs detallados de request, respuesta y errores de AFIP para diagnostico fiscal.
