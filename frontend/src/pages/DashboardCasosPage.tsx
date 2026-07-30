import { useEffect, useState } from 'react';
import { LayoutDashboard, AlertTriangle, Boxes, Clock3, TrendingDown, TrendingUp } from 'lucide-react';
import { getNoConformidadesDashboard } from '../services/noConformidades';
import type { NoConformidadesDashboard } from '../types/noConformidades';

const formatMonto = (value: number) =>
  `U$D ${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPercent = (value?: number | null) =>
  value === null || value === undefined ? '—' : `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;

function StatTile({
  label,
  value,
  sublabel,
  tone = 'default',
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: 'default' | 'good' | 'critical';
}) {
  const valueColor =
    tone === 'good' ? 'text-emerald-700' : tone === 'critical' ? 'text-rose-600' : 'text-slate-900';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</p>
      {sublabel && <p className="text-xs text-slate-400 mt-1">{sublabel}</p>}
    </div>
  );
}

function BarList({
  items,
  formatValue,
  emptyLabel,
}: {
  items: { nombre: string; valor: number }[];
  formatValue: (value: number) => string;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((i) => i.valor), 1);
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.nombre}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-700 font-medium truncate pr-2">{item.nombre}</span>
            <span className="text-slate-600 font-semibold whitespace-nowrap">{formatValue(item.valor)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${Math.max((item.valor / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardCasosPage() {
  const [data, setData] = useState<NoConformidadesDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getNoConformidadesDashboard();
        setData(res);
      } catch (error) {
        console.error(error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <p className="text-center text-slate-400 py-12">Cargando dashboard...</p>;
  }

  if (!data) {
    return <p className="text-center text-slate-400 py-12">No se pudo cargar el dashboard.</p>;
  }

  const utilidadNegativa = data.utilidad_neta_total < 0;

  return (
    <section className="space-y-6 w-full">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg md:text-xl font-semibold text-slate-800 flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-blue-600" />
          Dashboard de Seguimiento de Casos
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Indicadores generales de Reclamos, No Conformidades y su impacto económico.
        </p>
      </div>

      {/* Volumen de casos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total de Casos" value={String(data.total_casos)} />
        <StatTile
          label="No Conformidades"
          value={String(data.total_no_conformidades)}
          sublabel={data.total_casos > 0 ? `${formatPercent((data.total_no_conformidades / data.total_casos) * 100)} del total` : undefined}
        />
        <StatTile
          label="Reclamos"
          value={String(data.total_reclamos)}
          sublabel={data.total_casos > 0 ? `${formatPercent((data.total_reclamos / data.total_casos) * 100)} del total` : undefined}
        />
        <StatTile label="Con Carpeta Vinculada" value={String(data.casos_con_carpeta_vinculada)} />
      </div>

      {/* Estado y cumplimiento */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="En Proceso" value={String(data.casos_en_proceso)} />
        <StatTile label="Resueltos" value={String(data.casos_resueltos)} />
        <StatTile label="Cumplimiento en Plazo" value={formatPercent(data.porcentaje_en_plazo)} />
        <StatTile
          label="Días Promedio de Resolución"
          value={data.dias_promedio_resolucion != null ? `${data.dias_promedio_resolucion.toLocaleString('es-AR')} días` : '—'}
        />
      </div>

      {/* Impacto económico */}
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
          <Boxes className="h-4 w-4 text-slate-500" /> Impacto Económico
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatTile label="Monto Total de Órdenes de Compra" value={formatMonto(data.monto_total_oc)} />
          <StatTile label="Costos de No Calidad Totales" value={formatMonto(data.costos_no_calidad_total)} tone="critical" />
          <StatTile
            label="Utilidad Neta Total"
            value={formatMonto(data.utilidad_neta_total)}
            tone={utilidadNegativa ? 'critical' : 'good'}
          />
        </div>

        {data.monto_total_oc > 0 && (
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-slate-600 flex items-center gap-1.5">
                {utilidadNegativa ? (
                  <TrendingDown className="h-4 w-4 text-rose-500" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                )}
                Impacto de los costos de no calidad sobre la Orden de Compra
              </span>
              <span className={`font-bold ${utilidadNegativa ? 'text-rose-600' : 'text-slate-800'}`}>
                {formatPercent(data.porcentaje_impacto_costos)}
              </span>
            </div>
            <div className="h-3 rounded-full bg-emerald-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-rose-500"
                style={{ width: `${Math.min(data.porcentaje_impacto_costos ?? 0, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {formatPercent(data.porcentaje_impacto_costos)} de la rentabilidad de las Órdenes de Compra con casos abiertos se destinó a tratar Costos de No Calidad.
            </p>
          </div>
        )}
      </article>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="font-semibold text-slate-900 mb-4">Casos por Sector</h4>
          <BarList
            items={data.por_sector.map((s) => ({ nombre: s.nombre, valor: s.cantidad }))}
            formatValue={(v) => String(v)}
            emptyLabel="Sin casos registrados."
          />
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="font-semibold text-slate-900 mb-4">Costos de No Calidad por Concepto</h4>
          <BarList
            items={data.costos_por_concepto.map((c) => ({ nombre: c.nombre, valor: c.monto }))}
            formatValue={(v) => formatMonto(v)}
            emptyLabel="Sin costos de no calidad cargados."
          />
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-slate-500" /> Casos por Vendedor
          </h4>
          <BarList
            items={data.por_vendedor.map((v) => ({ nombre: v.nombre, valor: v.cantidad_casos }))}
            formatValue={(v) => String(v)}
            emptyLabel="Sin datos de vendedores."
          />
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-slate-500" /> Costeo por Cliente
          </h4>
          {data.por_cliente.length === 0 ? (
            <p className="text-sm text-slate-400">Sin casos vinculados a una carpeta.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-100">
                    <th className="py-2 pr-3 text-xs font-semibold text-slate-500 uppercase">Cliente</th>
                    <th className="py-2 pr-3 text-xs font-semibold text-slate-500 uppercase text-right">Casos</th>
                    <th className="py-2 pr-3 text-xs font-semibold text-slate-500 uppercase text-right">Monto OC</th>
                    <th className="py-2 text-xs font-semibold text-slate-500 uppercase text-right">Costos NC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.por_cliente.map((c) => (
                    <tr key={c.nombre}>
                      <td className="py-2 pr-3 text-slate-700 truncate max-w-[160px]">{c.nombre}</td>
                      <td className="py-2 pr-3 text-slate-700 text-right">{c.cantidad_casos}</td>
                      <td className="py-2 pr-3 text-slate-700 text-right whitespace-nowrap">{formatMonto(c.monto_oc)}</td>
                      <td className="py-2 text-rose-600 font-medium text-right whitespace-nowrap">{formatMonto(c.costos_no_calidad)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
