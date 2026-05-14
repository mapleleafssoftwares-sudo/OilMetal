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

        {/* Flow diagram */}
        {!selected && (
          <div className="mb-6 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                Flujo de trabajo
              </h2>
              <p className="text-xs text-slate-400 mt-1">El Administrador supervisa todo. Los aportes internos son independientes y ocurren en paralelo, sin orden fijo.</p>
            </div>
            <div className="p-5 sm:p-8">

              {/* Admin supervision frame */}
              <div className="relative border-2 border-dashed border-violet-200 rounded-2xl px-4 sm:px-10 pt-10 pb-6">

                {/* Admin pill */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg shadow-violet-200 whitespace-nowrap">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Administrador — supervisa todo el flujo
                  </div>
                </div>

                <div className="flex flex-col items-center">

                  {/* Step 1: Vendedor creates OC */}
                  <div className="flex items-center gap-3 px-5 py-3.5 bg-blue-50 border-2 border-blue-300 rounded-2xl shadow-sm w-full max-w-xs">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-900">Vendedor</p>
                      <p className="text-xs text-blue-600 mt-0.5">Crea la carpeta Orden de Compra</p>
                    </div>
                  </div>

                  {/* Fork: 1 line splits into 3 */}
                  <svg viewBox="0 0 300 50" className="w-full max-w-sm h-12" preserveAspectRatio="none">
                    <line x1="150" y1="0" x2="150" y2="14" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="50" y1="14" x2="250" y2="14" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="50" y1="14" x2="50" y2="42" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="150" y1="14" x2="150" y2="42" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="250" y1="14" x2="250" y2="42" stroke="#94a3b8" strokeWidth="2" />
                    <polygon points="46,38 50,44 54,38" fill="#94a3b8" />
                    <polygon points="146,38 150,44 154,38" fill="#94a3b8" />
                    <polygon points="246,38 250,44 254,38" fill="#94a3b8" />
                  </svg>

                  {/* 3 parallel boxes */}
                  <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
                    <div className="flex flex-col items-center p-3 bg-blue-50 border-2 border-blue-200 rounded-xl text-center">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center mb-2">
                        <FileText className="h-4 w-4 text-white" />
                      </div>
                      <p className="text-xs font-bold text-blue-800 leading-tight">Vendedor</p>
                      <p className="text-[11px] text-blue-600 mt-1 leading-tight">Vincula Orden de Compra</p>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-center">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center mb-2">
                        <FolderOpen className="h-4 w-4 text-white" />
                      </div>
                      <p className="text-xs font-bold text-emerald-800 leading-tight">Depósito</p>
                      <p className="text-[11px] text-emerald-600 mt-1 leading-tight">Vincula Remitos</p>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-amber-50 border-2 border-amber-200 rounded-xl text-center">
                      <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center mb-2">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                      <p className="text-xs font-bold text-amber-800 leading-tight">Calidad</p>
                      <p className="text-[11px] text-amber-600 mt-1 leading-tight">Vincula Certificados</p>
                    </div>
                  </div>

                  {/* Join: 3 lines converge into 1 */}
                  <svg viewBox="0 0 300 50" className="w-full max-w-sm h-12" preserveAspectRatio="none">
                    <line x1="50" y1="0" x2="50" y2="32" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="150" y1="0" x2="150" y2="32" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="250" y1="0" x2="250" y2="32" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="50" y1="32" x2="250" y2="32" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="150" y1="32" x2="150" y2="44" stroke="#94a3b8" strokeWidth="2" />
                    <polygon points="146,40 150,46 154,40" fill="#94a3b8" />
                  </svg>

                  {/* Carpeta completa */}
                  <div className="flex items-center gap-3 px-5 py-3.5 bg-slate-50 border-2 border-slate-300 rounded-2xl shadow-sm w-full max-w-xs">
                    <div className="w-10 h-10 rounded-xl bg-slate-600 flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Carpeta completa</p>
                      <p className="text-xs text-slate-500 mt-0.5">Documentos listos para el cliente</p>
                    </div>
                  </div>

                  {/* Arrow down */}
                  <svg viewBox="0 0 20 36" className="w-5 h-9">
                    <line x1="10" y1="0" x2="10" y2="28" stroke="#94a3b8" strokeWidth="2" />
                    <polygon points="6,24 10,32 14,24" fill="#94a3b8" />
                  </svg>

                  {/* Consultor */}
                  <div className="flex items-center gap-3 px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl shadow-sm w-full max-w-xs">
                    <div className="w-10 h-10 rounded-xl bg-slate-500 flex items-center justify-center flex-shrink-0">
                      <Eye className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">Consultor (Cliente)</p>
                      <p className="text-xs text-slate-500 mt-0.5">Visualiza los documentos de su empresa</p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded border-2 border-dashed border-violet-300 inline-block flex-shrink-0" />
                  Admin supervisa desde la creación hasta la consulta del cliente
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex gap-0.5 flex-shrink-0">
                    <span className="w-2 h-4 rounded-l bg-blue-200 inline-block" />
                    <span className="w-2 h-4 bg-emerald-200 inline-block" />
                    <span className="w-2 h-4 rounded-r bg-amber-200 inline-block" />
                  </span>
                  Vendedor, Depósito y Calidad aportan en paralelo, sin orden fijo
                </span>
              </div>
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
