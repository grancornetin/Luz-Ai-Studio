import React, { useState } from 'react';
import { Plus, Edit3, Trash2, Star, StarOff, AlertCircle, Palette, Tag, Clock, CalendarDays, Download } from 'lucide-react';
import { downloadBrandReport } from '../../utils/brandReportUtils';

function isColorDark(hex: string): boolean {
  if (!hex || hex[0] !== '#') return false;
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useBrandProfiles } from '../../hooks/useBrandProfiles';
import { BrandCoreWizard } from './BrandCoreWizard';
import { BrandLivingProfile } from './BrandLivingProfile';
import type { BrandProfile } from './types';

// ── HELPERS ──────────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000)    return 'Hace un momento';
  if (diff < 3_600_000) return `Hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `Hace ${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  incomplete: { label: 'Incompleta',  color: '#F59E0B', bg: '#FEF3C7' },
  basic:      { label: 'Básica',      color: '#6366F1', bg: '#EEF2FF' },
  complete:   { label: 'Completa',    color: '#10B981', bg: '#D1FAE5' },
  advanced:   { label: 'Avanzada',    color: '#F72C5B', bg: '#FFE4EC' },
};

// ── BRAND CARD ───────────────────────────────────────────────────────────────────

interface BrandCardProps {
  profile: BrandProfile;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  deleting: boolean;
}

function BrandCard({ profile, onEdit, onDelete, onSetDefault, deleting }: BrandCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();
  const primaryColor = profile.visualIdentity?.colors?.[0]?.hex || '#F72C5B';
  const initial = (profile.brandName || 'M').slice(0, 1).toUpperCase();
  const logoAsset = profile.visualIdentity?.assets?.find(a => a.type === 'logo');
  const isPng = logoAsset?.mimeType === 'image/png' || logoAsset?.fileName?.toLowerCase().endsWith('.png');
  const avatarBg = logoAsset && isPng && !isColorDark(primaryColor) ? '#000000' : primaryColor;
  const st = STATUS_LABELS[profile.status] || STATUS_LABELS.incomplete;
  const isComplete = profile.status === 'complete' || profile.status === 'advanced';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all group">
      {/* Barra de progreso top */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full transition-all"
          style={{
            width: `${profile.completionScore}%`,
            background: isComplete ? '#10B981' : '#F72C5B',
          }}
        />
      </div>

      <div className="p-5">
        {/* Cabecera */}
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-white font-black text-lg shadow-sm"
            style={{ background: avatarBg }}
          >
            {logoAsset ? (
              <img src={logoAsset.url} alt={profile.brandName} className="w-10 h-10 object-contain" />
            ) : initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 truncate">{profile.brandName}</h3>
              {profile.isDefault && (
                <Star size={12} className="flex-shrink-0" style={{ color: '#F72C5B', fill: '#F72C5B' }} />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Tag size={11} className="text-slate-400" />
              <p className="text-[11px] text-slate-400 truncate">{profile.mainCategory || 'Sin categoría'}</p>
            </div>
          </div>
          <span
            className="flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-xl"
            style={{ color: st.color, background: st.bg }}
          >
            {st.label}
          </span>
        </div>

        {/* Mini paleta */}
        {profile.visualIdentity?.colors?.length > 0 && (
          <div className="flex gap-1.5 mb-3">
            {profile.visualIdentity.colors.slice(0, 7).map(c => (
              <div
                key={c.id}
                className="w-5 h-5 rounded-md border border-white shadow-sm flex-shrink-0"
                style={{ background: c.hex }}
                title={`${c.label} · ${c.hex}`}
              />
            ))}
          </div>
        )}

        {/* Score */}
          <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
            <Clock size={11} />
            {formatDate(profile.updatedAt)}
          </div>
          <p className="mb-3 text-xs text-slate-500">
            {isComplete ? 'Tus planes ya salen a tu medida.' : 'Complétala para personalizar los textos de tus publicaciones.'}
          </p>
          <div className="flex items-center gap-1.5 text-[10px]">
            {!isComplete && (
              <span className="font-black" style={{ color: '#F72C5B' }}>{profile.completionScore}% completo</span>
            )}
            {isComplete && (
              <span className="text-green-600 font-black flex items-center gap-1">
                ✓ Lista para usar
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        {confirmDelete ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-600 font-bold text-center">¿Eliminar "{profile.brandName}"?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 rounded-xl text-xs font-black bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={onDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-xl text-xs font-black bg-rose-100 text-rose-600 hover:bg-rose-200 transition-all disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {isComplete ? (
              <div className="flex gap-2">
                <button
                  onClick={onEdit}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                >
                  <Edit3 size={13} /> Abrir perfil
                </button>
                <button
                  onClick={() => navigate('/planner')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black text-white transition-all shadow-sm"
                  style={{ background: primaryColor }}
                >
                  <CalendarDays size={13} /> Usar en el planificador
                </button>
              </div>
            ) : (
              <button
                onClick={onEdit}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black text-white transition-all shadow-sm"
                style={{ background: '#F72C5B' }}
              >
                Seguir completando (2 min)
              </button>
            )}

            <div className="flex gap-1">
              <button
                onClick={onSetDefault}
                title={profile.isDefault ? 'Ya es la predeterminada' : 'Marcar como predeterminada'}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-all"
              >
                {profile.isDefault ? <Star size={12} style={{ fill: '#F72C5B', color: '#F72C5B' }} /> : <StarOff size={12} />}
                {profile.isDefault ? 'Predeterminada' : 'Predeterminar'}
              </button>
              <button
                onClick={() => downloadBrandReport(profile)}
                title="Descargar informe de marca"
                className="flex items-center justify-center px-3 py-1.5 rounded-xl text-[11px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
              >
                <Download size={12} />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center justify-center px-3 py-1.5 rounded-xl text-[11px] text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── EMPTY STATE ───────────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
      <div
        className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-lg"
        style={{ background: 'rgba(247,44,91,0.1)' }}
      >
        <Palette size={32} style={{ color: '#F72C5B' }} />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-3">Tu marca merece una identidad clara</h2>
      <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto mb-6">
        Cuéntale a Luz sobre tu marca una sola vez. Tus planes, textos e imágenes saldrán hechos a tu medida.
      </p>
      <button
        onClick={onNew}
        className="inline-flex min-h-11 items-center gap-2 px-6 py-3 rounded-[14px] text-white text-sm font-bold transition-all shadow-lg"
        style={{ background: '#F72C5B', boxShadow: '0 8px 24px rgba(247,44,91,0.3)' }}
      >
        <Plus size={16} /> Crear mi marca (4 min)
      </button>
    </div>
  );
}

// ── MODULE PRINCIPAL ──────────────────────────────────────────────────────────────

type View = 'list' | 'wizard' | 'profile';

export const BrandProfilesModule: React.FC = () => {
  const { user } = useAuth();
  const { profiles, loading, error, reload, deleteProfile, setDefault } = useBrandProfiles(user?.uid);
  const [view, setView] = useState<View>('list');
  const [editingProfile, setEditingProfile] = useState<BrandProfile | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const startCreate = () => {
    setEditingProfile(undefined);
    setView('wizard');
  };

  const startEdit = (profile: BrandProfile) => {
    setEditingProfile(profile);
    setView('profile');
  };

  const handleSaved = async (_saved: BrandProfile) => {
    await reload();
  };

  const handleDelete = async (profileId: string) => {
    setDeletingId(profileId);
    setActionError(null);
    try {
      await deleteProfile(profileId);
    } catch (err: any) {
      setActionError(err.message || 'Error al eliminar la marca.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (profileId: string) => {
    setActionError(null);
    try {
      await setDefault(profileId);
    } catch (err: any) {
      setActionError(err.message || 'Error al cambiar la marca predeterminada.');
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-sm text-slate-400">Debes iniciar sesión para ver tus marcas.</p>
      </div>
    );
  }

  if (view === 'wizard') {
    return (
      <div className="-m-4 md:-m-10 min-h-screen">
        <BrandCoreWizard
          userId={user.uid}
          onDone={handleSaved}
          onBack={() => setView('list')}
        />
      </div>
    );
  }
  if (view === 'profile' && editingProfile) {
    return <div className="-m-4 md:-m-10 min-h-screen"><BrandLivingProfile userId={user.uid} profile={editingProfile} onBack={() => setView('list')} onUpdated={handleSaved}/></div>;
  }

  // Vista lista
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold text-[#F72C5B] uppercase tracking-widest mb-2">Mis marcas</p>
          <h1 className="text-3xl font-black text-slate-800 leading-tight">
            El cerebro de <span style={{ color: '#F72C5B' }}>tu marca</span>
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-lg leading-relaxed">
            Una identidad clara que personaliza tus planes, textos e imágenes.
          </p>
        </div>
        {profiles.length > 0 && (
          <button
            onClick={startCreate}
            className="inline-flex min-h-11 items-center gap-2 px-5 py-3 rounded-[14px] text-white text-sm font-bold shadow-sm flex-shrink-0 transition-all"
            style={{ background: '#F72C5B', boxShadow: '0 4px 16px rgba(247,44,91,0.3)' }}
          >
            <Plus size={16} /> Crear nueva marca
          </button>
        )}
      </div>

      {/* Error global */}
      {(error || actionError) && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl">
          <AlertCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-rose-700">Ocurrió un error</p>
            <p className="text-xs text-rose-600 mt-0.5">{error || actionError}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white rounded-2xl border border-slate-100 h-56" />
          ))}
        </div>
      )}

      {/* Grid de marcas */}
      {!loading && profiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {profiles.map(p => (
            <BrandCard
              key={p.id}
              profile={p}
              onEdit={() => startEdit(p)}
              onDelete={() => handleDelete(p.id)}
              onSetDefault={() => handleSetDefault(p.id)}
              deleting={deletingId === p.id}
            />
          ))}
          {/* Card "Crear nueva" */}
          <button
            type="button"
            onClick={startCreate}
            className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#F72C5B] hover:bg-rose-50/20 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-rose-100 flex items-center justify-center transition-colors">
              <Plus size={22} className="text-slate-400 group-hover:text-[#F72C5B] transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-slate-600 group-hover:text-[#F72C5B] transition-colors">Crear nueva marca</p>
              <p className="text-xs text-slate-500 mt-0.5">Guarda lo esencial de tu marca en pocos pasos.</p>
            </div>
          </button>
        </div>
      )}

      {/* Estado vacío */}
      {!loading && profiles.length === 0 && (
        <EmptyState onNew={startCreate} />
      )}

    </div>
  );
};

export default BrandProfilesModule;
