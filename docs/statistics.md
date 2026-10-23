# Estadísticas de Orbit

## Balance recurrente

Los ingresos usan el ciclo y la base sin IVA de los clientes activos. Los gastos usan el ciclo y la base sin IVA de los gastos activos. Ambos se convierten a su equivalente mensual, con las mismas funciones que las páginas de Clientes y Gastos.

- Beneficio operativo recurrente estimado = MRR − gastos recurrentes mensuales sin IVA.
- Margen operativo = beneficio recurrente / MRR × 100. Sin ingresos recurrentes se muestra «—».
- Los importes anuales conservan la anualización de cada ciclo; el equivalente mensual se redondea a céntimos.

Es un resultado estimado de los contratos y costes registrados, antes de impuestos sobre beneficios. No calcula beneficio contable neto, pagos reales, retenciones, amortizaciones ni deducibilidad del IVA. Solo incluye los costes que se hayan registrado en Orbit.

## Previsión

El horizonte es de 3, 6 o 12 meses completos a partir del mes siguiente. Los límites de mes usan Europe/Madrid. El escenario base conserva los contratos y costes recurrentes actuales; no inventa altas de clientes ni crecimiento.

El usuario puede aplicar variaciones mensuales entre −100 % y 100 % para ingresos y costes recurrentes. Se componen desde el primer mes futuro: base mensual × (1 + variación / 100) elevado al número de mes. Los importes mensuales se redondean a céntimos; el resultado acumulado suma los resultados mensuales en céntimos.

Los gastos puntuales activos se suman una vez al mes de su fecha prevista, sin IVA. Los puntuales sin fecha, pasados o fuera del horizonte no se incluyen. Las variaciones de costes no modifican esos importes puntuales. Se excluyen ingresos puntuales, clientes no activos y gastos pausados. Los ciclos recurrentes se prorratean; no se simulan las fechas reales de emisión o cargo.

## Comerciales

La clasificación usa exclusivamente la asignación actual del cliente. Puede ordenarse por clientes asignados, clientes activos o MRR de la cartera. Incluye comerciales sin clientes y una fila separada para clientes sin comercial. El MRR excluye clientes no activos y ciclos puntuales o sin configurar.

Orbit no guarda qué comercial captó originalmente cada cliente ni un historial de reasignaciones. Por eso la página lo presenta como cartera actual, sin atribuir captaciones históricas o calcular una tasa de conversión de ventas.

## Gastos por categoría

Incluye solo gastos recurrentes activos, sin IVA. La cuota porcentual de cada categoría se calcula sobre el coste anual recurrente. Los equivalentes mensuales de cada categoría se redondean por separado y pueden presentar diferencias de un céntimo frente al total mensual redondeado globalmente.

## Facturación registrada

Se agrupan facturas por su fecha de emisión, incluyendo el mes actual y los 5 u 11 anteriores. Solo se consideran los estados paid, sent, pending y overdue. Se excluyen borradores, anuladas, facturas sin fecha válida y valores no numéricos. Las fechas ausentes se cuentan y se muestran junto a la serie.

El importe de cada factura se utiliza tal como está registrado: actualmente no tiene desglose de base e IVA. No se utiliza para calcular el beneficio sin IVA ni se suma a los contratos recurrentes, evitando duplicidades. «Facturas pagadas» indica su estado actual, agrupado por emisión; no la fecha de cobro. Los gastos actuales son una configuración de costes y no un historial de gastos pagados, por lo que no se inventan costes históricos.

## Verificación

```sh
node --test tests/statistics.test.mjs tests/expenses.test.mjs tests/client-billing.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
```

La sección no escribe datos ni modifica el esquema de PocketBase.
