# Comisiones comerciales de Tickit POS

La cartera de cada comercial permite configurar un acuerdo por cliente y comercial. El cliente debe estar asignado a ese comercial al crear el acuerdo. Cada acuerdo conserva su titular original al reasignar el cliente; los acuerdos anteriores siguen accesibles desde la cartera del comercial original. No se transfieren ni finalizan automáticamente.

## Condiciones

Los valores iniciales siguen el plan aportado:

- Bono de alta: una cuota mensual de software; media cuota en Basic. Se genera cuando están registradas como cobradas las mensualidades 1 y 2. La base es el software sin IVA efectivamente cobrado en la segunda mensualidad.
- Comisión recurrente: 10 % sobre cada mensualidad de software efectivamente cobrada, de la 3 a la 60, ambas incluidas (58 mensualidades).
- Baja o impago antes de cobrar la cuarta mensualidad: al finalizar el acuerdo, se revierte el bono generado si no consta cobrada la mensualidad 4. El ajuste se muestra separado como deducción para futuras liquidaciones. No se revierte la comisión recurrente que ya corresponde a cuotas cobradas.
- Hardware, instalación e IVA quedan fuera de todas las bases.

Por cliente se puede personalizar plan, cuota mensual neta de software para la estimación, mes de primera cuota, multiplicador del bono, porcentaje, primer y último mes de comisión (hasta 120), estado y último mes del acuerdo. Seleccionar Basic propone 0,5 cuotas de bono; Pro o Business proponen 1. El resto de condiciones puede adaptarse al contrato. La cuota se sugiere a partir del equivalente mensual de la facturación del cliente y debe revisarse para excluir conceptos no comisionables. El inicio y los cobros requieren confirmación manual; no se deducen del alta del cliente.

Editar las condiciones recalcula el acuerdo entero, incluidos cobros anteriores. Los cambios de facturación del cliente no modifican automáticamente acuerdos ya configurados. La baja o impago se registra explícitamente en el acuerdo, sin inferirla del estado genérico del cliente. Un acuerdo finalizado no admite mensualidades posteriores al mes de cierre; sí permite registrar cobros tardíos de mensualidades anteriores.

## Registro de cobros

Cada mensualidad íntegramente cobrada se registra una vez, con número de mes desde la primera cuota, importe de software sin IVA y fecha real del cobro. No se registran importes parciales como cuotas completas. Para pagos trimestrales o anuales, registra las bases de las mensualidades cubiertas por ese pago, evitando duplicidades. Las cuotas cubiertas pueden ser futuras respecto de la fecha de cobro por pagos anticipados.

Los cobros se pueden corregir retirando el registro y volviéndolo a introducir. El resumen distingue bono generado, comisión recurrente, ajuste de bono y total generado. Redondea cada comisión y bono a céntimos, y suma importes en céntimos. No registra pagos al comercial ni indica importes pendientes de liquidación. No importa automáticamente las facturas, que todavía no desglosan software, hardware e IVA.

La estimación potencial presupone cuota constante y cobro de todas las mensualidades. No es una garantía de ingresos ni se cuenta como comisión generada. No se generan gastos automáticamente y estos importes aún no se restan de las estadísticas de beneficio operativo; evita duplicarlos si registras liquidaciones como gastos.

## Ejemplos del documento

| Cuota mensual neta | Bono | Comisión mensual | Total con 58 cuotas recurrentes |
| --- | --- | --- | --- |
| 29 € (Basic) | 14,50 € | 2,90 € | 182,70 € |
| 49 € | 49 € | 4,90 € | 333,20 € |
| 79 € | 79 € | 7,90 € | 537,20 € |
| 104 € | 104 € | 10,40 € | **707,20 €** |
| 129 € | 129 € | 12,90 € | 877,20 € |

La aplicación usa la fórmula del plan: para una cuota de 104 €, el total es 104 + 58 × 10,40 = 707,20 €. Las proyecciones de captación y bajas del folleto son ilustrativas y no se convierten en datos del workspace.

## Despliegue y persistencia

Despliega primero `1792807200_sales_commissions.js` y los hooks actualizados, incluido `pb_hooks/lib/commission-rules.js`; después publica la web. La migración crea `sales_commissions` vacía, conserva los datos existentes y no asigna comisiones automáticamente. El Dockerfile ya copia la carpeta de hooks completa.

La colección se aísla por workspace; cliente y comercial deben pertenecer al mismo. Su identidad y workspace son inmutables. Un índice único evita duplicar acuerdos del mismo cliente y comercial. Se conservan los acuerdos: su eliminación por usuarios está bloqueada, y las relaciones obligatorias impiden eliminar clientes o comerciales con acuerdos. La interfaz desactiva la eliminación de esos comerciales y explica el motivo. Finaliza el acuerdo para cerrar sus condiciones.

El validador y los cálculos se comparten entre web y PocketBase. Las reglas del servidor validan también importes, fechas, límites, duplicados y cierre; no dependen de validación de formularios.

## Verificación

```sh
node --test tests/commissions.test.mjs tests/client-billing.test.mjs tests/expenses.test.mjs tests/statistics.test.mjs
node --test tests/pocketbase.integration.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
```

La integración verifica migración reversible sobre una instalación existente, persistencia, cobros duplicados, errores, aislamiento entre workspaces, protección de identidad e historial y reasignación de clientes.
