import { useState } from 'react';
import {
  Users, FolderOpen, FileText, ShieldCheck, Eye, Edit,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, Info
} from 'lucide-react';

// ── Role definitions ─────────────────────────────────────────────────────────

const ROLES = [
  {
    key: 'admin',
    label: 'Administrador',
    color: 'violet',
    icon: ShieldCheck,
    description: 'Acceso total al sistema. Gestiona usuarios, documentos y carpetas.',
  },
  {
    key: 'vendedor',
    label: 'Vendedor',
    color: 'blue',
    icon: FileText,
    description: 'Crea carpetas de Orden de Compra y gestiona documentos de Ordenes de Compra.',
  },
  {
    key: 'deposito',
    label: 'Depósito',
    color: 'emerald',
    icon: FolderOpen,
    description: 'Gestiona documentos de Remitos y Pedidos.',
  },
  {
    key: 'calidad',
    label: 'Calidad',
    color: 'amber',
    icon: CheckCircle2,
    description: 'Gestiona documentos de Certificaciones.',
  },
  {
    key: 'consultor',
    label: 'Consultor',
    color: 'slate',
    icon: Eye,
    description: 'Acceso externo de sólo lectura a los documentos de su empresa.',
  },
] as const;

type RolKey = typeof ROLES[number]['key'];

// ── Permission matrix ────────────────────────────────────────────────────────

interface Permission {
  can: boolean;
  detail?: string;
}

interface ModulePerms {
  // Repositorio
  repoTab_certificaciones: Permission;
  repoTab_ordenes: Permission;
  repoTab_remitos: Permission;
  repoUpload: Permission;
  repoDelete: Permission;
  // Gestión Documentos
  gestionVerCarpetas: Permission;
  gestionCrearCarpeta: Permission;
  gestionEliminarCarpeta: Permission;
  gestionVincularCert: Permission;
  gestionVincularOC: Permission;
  gestionVincularRemito: Permission;
  gestionDesvincular: Permission;
  // Usuarios
  gestionUsuarios: Permission;
}

const MATRIX: Record<RolKey, ModulePerms> = {
  admin: {
    repoTab_certificaciones: { can: true },
    repoTab_ordenes:         { can: true },
    repoTab_remitos:         { can: true },
    repoUpload:              { can: true },
    repoDelete:              { can: true },
    gestionVerCarpetas:      { can: true },
    gestionCrearCarpeta:     { can: true },
    gestionEliminarCarpeta:  { can: true },
    gestionVincularCert:     { can: true },
    gestionVincularOC:       { can: true },
    gestionVincularRemito:   { can: true },
    gestionDesvincular:      { can: true },
    gestionUsuarios:         { can: true },
  },
  vendedor: {
    repoTab_certificaciones: { can: false },
    repoTab_ordenes:         { can: true },
    repoTab_remitos:         { can: false },
    repoUpload:              { can: true, detail: 'Solo en Ordenes de Compra' },
    repoDelete:              { can: true, detail: 'Solo en Ordenes de Compra' },
    gestionVerCarpetas:      { can: true },
    gestionCrearCarpeta:     { can: true },
    gestionEliminarCarpeta:  { can: false },
    gestionVincularCert:     { can: false },
    gestionVincularOC:       { can: true },
    gestionVincularRemito:   { can: false },
    gestionDesvincular:      { can: true, detail: 'Solo documentos de Ordenes de Compra' },
    gestionUsuarios:         { can: false },
  },
  deposito: {
    repoTab_certificaciones: { can: false },
    repoTab_ordenes:         { can: false },
    repoTab_remitos:         { can: true },
    repoUpload:              { can: true, detail: 'Solo en Remitos' },
    repoDelete:              { can: true, detail: 'Solo en Remitos' },
    gestionVerCarpetas:      { can: true },
    gestionCrearCarpeta:     { can: false },
    gestionEliminarCarpeta:  { can: false },
    gestionVincularCert:     { can: false },
    gestionVincularOC:       { can: false },
    gestionVincularRemito:   { can: true },
    gestionDesvincular:      { can: true, detail: 'Solo documentos de Remitos' },
    gestionUsuarios:         { can: false },
  },
  calidad: {
    repoTab_certificaciones: { can: true },
    repoTab_ordenes:         { can: false },
    repoTab_remitos:         { can: false },
    repoUpload:              { can: true, detail: 'Solo en Certificaciones' },
    repoDelete:              { can: true, detail: 'Solo en Certificaciones' },
    gestionVerCarpetas:      { can: true },
    gestionCrearCarpeta:     { can: false },
    gestionEliminarCarpeta:  { can: false },
    gestionVincularCert:     { can: true },
    gestionVincularOC:       { can: false },
    gestionVincularRemito:   { can: false },
    gestionDesvincular:      { can: true, detail: 'Solo documentos de Certificaciones' },
    gestionUsuarios:         { can: false },
  },
  consultor: {
    repoTab_certificaciones: { can: false },
    repoTab_ordenes:         { can: false },
    repoTab_remitos:         { can: false },
    repoUpload:              { can: false },
    repoDelete:              { can: false },
    gestionVerCarpetas:      { can: true, detail: 'Solo carpetas de su empresa' },
    gestionCrearCarpeta:     { can: false },
    gestionEliminarCarpeta:  { can: false },
    gestionVincularCert:     { can: false },
    gestionVincularOC:       { can: false },
    gestionVincularRemito:   { can: false },
    gestionDesvincular:      { can: false },
    gestionUsuarios:         { can: false },
  },
};

// ── Styles ───────────────────────────────────────────────────────────────────

const COLOR = {
  violet: {
    card:    'border-violet-200 bg-violet-50',
    header:  'bg-violet-600',
    badge:   'bg-violet-100 text-violet-700',
    ring:    'ring-violet-400',
    icon:    'text-violet-600',
    active:  'border-violet-500 bg-violet-50 shadow-violet-100',
  },
  blue: {
    card:    'border-blue-200 bg-blue-50',
    header:  'bg-blue-600',
    badge:   'bg-blue-100 text-blue-700',
    ring:    'ring-blue-400',
    icon:    'text-blue-600',
    active:  'border-blue-500 bg-blue-50 shadow-blue-100',
  },
  emerald: {
    card:    'border-emerald-200 bg-emerald-50',
    header:  'bg-emerald-600',
    badge:   'bg-emerald-100 text-emerald-700',
    ring:    'ring-emerald-400',
    icon:    'text-emerald-600',
    active:  'border-emerald-500 bg-emerald-50 shadow-emerald-100',
  },
  amber: {
    card:    'border-amber-200 bg-amber-50',
    header:  'bg-amber-500',
    badge:   'bg-amber-100 text-amber-700',
    ring:    'ring-amber-400',
    icon:    'text-amber-500',
    active:  'border-amber-500 bg-amber-50 shadow-amber-100',
  },
  slate: {
    card:    'border-slate-200 bg-slate-50',
    header:  'bg-slate-500',
    badge:   'bg-slate-100 text-slate-600',
    ring:    'ring-slate-400',
    icon:    'text-slate-500',
    active:  'border-slate-400 bg-slate-50 shadow-slate-100',
  },
};

// ── Permission row ────────────────────────────────────────────────────────────

function PermRow({ label, perm }: { label: string; perm: Permission }) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-white/60 last:border-0">
      {perm.can
        ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
        : <XCircle      className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium ${perm.can ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
          {label}
        </p>
        {perm.can && perm.detail && (
          <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{perm.detail}</p>
        )}
      </div>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/70 hover:bg-white transition-colors mb-1"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{title}</span>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
      </button>
      {open && <div className="px-1">{children}</div>}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function InstructivoPage() {
  const [selected, setSelected] = useState<RolKey | null>(null);

  const displayRoles = selected ? ROLES.filter(r => r.key === selected) : ROLES;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto pb-10">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <Info className="h-5 w-5 text-indigo-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Instructivo de Roles y Permisos</h1>
          </div>
          <p className="text-sm text-slate-500 ml-12">
            Hacé clic en un rol para ver su detalle, o visualizá todos de forma comparativa.
          </p>
        </div>

        {/* Role selector pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelected(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
              selected === null
                ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            Todos los roles
          </button>
          {ROLES.map(r => {
            const c = COLOR[r.color];
            const Icon = r.icon;
            const isActive = selected === r.key;
            return (
              <button
                key={r.key}
                onClick={() => setSelected(isActive ? null : r.key)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all shadow-sm ${
                  isActive
                    ? `${c.active} shadow-md`
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? c.icon : 'text-slate-400'}`} />
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Flow overview (only when showing all) */}
        {!selected && (
          <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-500" />
              Flujo de responsabilidades
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-2 overflow-x-auto pb-2">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center min-w-[120px]">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center mb-2 shadow-sm">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-xs font-bold text-blue-700">Vendedor</span>
                <span className="text-[11px] text-slate-500 leading-tight mt-1">Crea la<br/>Orden de Compra</span>
              </div>
              <ArrowRight />
              {/* Step 2 */}
              <div className="flex flex-col items-center text-center min-w-[120px]">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border-2 border-blue-200 border-dashed flex items-center justify-center mb-2">
                  <FileText className="h-5 w-5 text-blue-400" />
                </div>
                <span className="text-xs font-bold text-blue-600">Vendedor</span>
                <span className="text-[11px] text-slate-500 leading-tight mt-1">Vincula docs de<br/>Ordenes de Compra</span>
              </div>
              <ArrowRight />
              {/* Step 3 */}
              <div className="flex flex-col items-center text-center min-w-[120px]">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mb-2 shadow-sm">
                  <FolderOpen className="h-6 w-6 text-emerald-600" />
                </div>
                <span className="text-xs font-bold text-emerald-700">Depósito</span>
                <span className="text-[11px] text-slate-500 leading-tight mt-1">Vincula docs de<br/>Remitos</span>
              </div>
              <ArrowRight />
              {/* Step 4 */}
              <div className="flex flex-col items-center text-center min-w-[120px]">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mb-2 shadow-sm">
                  <CheckCircle2 className="h-6 w-6 text-amber-500" />
                </div>
                <span className="text-xs font-bold text-amber-700">Calidad</span>
                <span className="text-[11px] text-slate-500 leading-tight mt-1">Vincula docs de<br/>Certificaciones</span>
              </div>
              <ArrowRight />
              {/* Step 5 */}
              <div className="flex flex-col items-center text-center min-w-[120px]">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-2 shadow-sm">
                  <Eye className="h-6 w-6 text-slate-500" />
                </div>
                <span className="text-xs font-bold text-slate-600">Consultor</span>
                <span className="text-[11px] text-slate-500 leading-tight mt-1">Visualiza la<br/>carpeta completa</span>
              </div>
              <ArrowRight />
              {/* Step 6 */}
              <div className="flex flex-col items-center text-center min-w-[120px]">
                <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center mb-2 shadow-sm">
                  <ShieldCheck className="h-6 w-6 text-violet-600" />
                </div>
                <span className="text-xs font-bold text-violet-700">Administrador</span>
                <span className="text-[11px] text-slate-500 leading-tight mt-1">Supervisa y gestiona<br/>todo el sistema</span>
              </div>
            </div>
            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-100 border border-indigo-300 inline-block" /> Roles internos (acceden por el panel de admin)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-100 border border-slate-300 inline-block" /> Consultor (accede por el portal externo)</span>
            </div>
          </div>
        )}

        {/* Role cards */}
        <div className={`grid gap-4 ${displayRoles.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'}`}>
          {displayRoles.map(role => {
            const c = COLOR[role.color];
            const Icon = role.icon;
            const perms = MATRIX[role.key];
            return (
              <div key={role.key} className={`border-2 rounded-2xl overflow-hidden shadow-sm ${c.card}`}>
                {/* Card header */}
                <div className={`${c.header} px-4 py-3 flex items-center gap-2.5`}>
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{role.label}</p>
                    <p className="text-[11px] text-white/70">
                      {role.key === 'consultor' ? 'Portal externo' : 'Panel interno'}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="px-4 py-3 border-b border-white/60">
                  <p className="text-xs text-slate-600 leading-relaxed">{role.description}</p>
                </div>

                {/* Permissions */}
                <div className="px-4 py-3 space-y-1">
                  <Section title="Repositorio PDFs" icon={FileText}>
                    <PermRow label="Tab Certificaciones"    perm={perms.repoTab_certificaciones} />
                    <PermRow label="Tab Ordenes de Compra"  perm={perms.repoTab_ordenes} />
                    <PermRow label="Tab Remitos"            perm={perms.repoTab_remitos} />
                    <PermRow label="Subir archivos"         perm={perms.repoUpload} />
                    <PermRow label="Eliminar archivos"      perm={perms.repoDelete} />
                  </Section>

                  <Section title="Gestión de Documentos" icon={FolderOpen}>
                    <PermRow label="Ver carpetas"                      perm={perms.gestionVerCarpetas} />
                    <PermRow label="Crear carpeta (Nueva OC)"          perm={perms.gestionCrearCarpeta} />
                    <PermRow label="Eliminar carpeta"                   perm={perms.gestionEliminarCarpeta} />
                    <PermRow label="Vincular Certificaciones"          perm={perms.gestionVincularCert} />
                    <PermRow label="Vincular Ordenes de Compra"        perm={perms.gestionVincularOC} />
                    <PermRow label="Vincular Remitos"                  perm={perms.gestionVincularRemito} />
                    <PermRow label="Desvincular documentos"            perm={perms.gestionDesvincular} />
                  </Section>

                  <Section title="Gestión de Usuarios" icon={Users}>
                    <PermRow label="Administrar usuarios y roles" perm={perms.gestionUsuarios} />
                  </Section>
                </div>
              </div>
            );
          })}
        </div>

        {/* Full comparison table */}
        {!selected && (
          <div className="mt-8 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Edit className="h-4 w-4 text-slate-500" />
                Tabla comparativa de permisos
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-56">Acción</th>
                    {ROLES.map(r => {
                      const c = COLOR[r.color];
                      return (
                        <th key={r.key} className="px-3 py-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded-full text-[11px] font-bold ${c.badge}`}>
                            {r.label}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {TABLE_ROWS.map((row, i) => (
                    <tr key={row.key} className={`border-t border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="px-4 py-2.5 font-medium text-slate-700">
                        {row.group && (
                          <span className="block text-[10px] text-slate-400 font-normal uppercase tracking-wide mb-0.5">
                            {row.group}
                          </span>
                        )}
                        {row.label}
                      </td>
                      {ROLES.map(r => {
                        const perm = MATRIX[r.key][row.key as keyof ModulePerms];
                        return (
                          <td key={r.key} className="px-3 py-2.5 text-center">
                            {perm.can
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                              : <XCircle      className="h-4 w-4 text-rose-300 mx-auto" />
                            }
                            {perm.can && perm.detail && (
                              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{perm.detail}</p>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ArrowRight() {
  return (
    <svg className="hidden sm:block h-5 w-5 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

const TABLE_ROWS: { key: string; label: string; group?: string }[] = [
  { key: 'repoTab_certificaciones', label: 'Tab Certificaciones',       group: 'Repositorio PDFs' },
  { key: 'repoTab_ordenes',         label: 'Tab Ordenes de Compra' },
  { key: 'repoTab_remitos',         label: 'Tab Remitos' },
  { key: 'repoUpload',              label: 'Subir archivos' },
  { key: 'repoDelete',              label: 'Eliminar archivos' },
  { key: 'gestionVerCarpetas',      label: 'Ver carpetas',              group: 'Gestión Documentos' },
  { key: 'gestionCrearCarpeta',     label: 'Crear carpeta (Nueva OC)' },
  { key: 'gestionEliminarCarpeta',  label: 'Eliminar carpeta' },
  { key: 'gestionVincularCert',     label: 'Vincular Certificaciones' },
  { key: 'gestionVincularOC',       label: 'Vincular Ordenes de Compra' },
  { key: 'gestionVincularRemito',   label: 'Vincular Remitos' },
  { key: 'gestionDesvincular',      label: 'Desvincular documentos' },
  { key: 'gestionUsuarios',         label: 'Administrar usuarios',      group: 'Usuarios' },
];
