/**
 * AccountSettings.tsx
 * Vista completa de configuración de cuenta con 4 pestañas:
 * Perfil público · Privacidad · Seguridad · Datos personales
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  User, Globe, Lock, Shield, Save, Check, X,
  Instagram, Linkedin, Globe2, AtSign, FileText,
  Bell, SlidersHorizontal, ChevronRight, Eye, EyeOff,
  Sparkles, Layers, Camera, Shirt, Package, Wand2
} from 'lucide-react';
import { useAuth, UserProfile, UserInterests, UserSocials, UserPreferences } from '../modules/auth/AuthContext';
import {
  getAuth,
  updatePassword,
  updateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { doc, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// ── CONSTANTES ──────────────────────────────────────────────────────────────

const INTEREST_CATEGORIES = [
  { id: 'moda',        label: 'Moda',        icon: 'fa-shirt' },
  { id: 'belleza',     label: 'Belleza',      icon: 'fa-star' },
  { id: 'tecnologia',  label: 'Tecnología',   icon: 'fa-microchip' },
  { id: 'gastronomia', label: 'Gastronomía',  icon: 'fa-utensils' },
  { id: 'fitness',     label: 'Fitness',      icon: 'fa-dumbbell' },
  { id: 'lifestyle',   label: 'Lifestyle',    icon: 'fa-sun' },
  { id: 'ecommerce',   label: 'E-commerce',   icon: 'fa-bag-shopping' },
  { id: 'arte',        label: 'Arte & Diseño', icon: 'fa-palette' },
];

const PREFERRED_MODULES = [
  { id: 'ai_generator',  label: 'AI Generator',   icon: <Wand2 className="w-3.5 h-3.5" /> },
  { id: 'scene_clone',   label: 'Scene Clone',     icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'content_studio',label: 'Content Studio',  icon: <Camera className="w-3.5 h-3.5" /> },
  { id: 'outfit_kit',    label: 'Outfit Kit',      icon: <Shirt className="w-3.5 h-3.5" /> },
  { id: 'product_shots', label: 'Product Shots',   icon: <Package className="w-3.5 h-3.5" /> },
  { id: 'model_dna',     label: 'Model DNA',       icon: <Sparkles className="w-3.5 h-3.5" /> },
];

type AccountTab = 'public' | 'privacy' | 'security' | 'personal';

const TABS: { id: AccountTab; label: string; icon: React.ReactNode }[] = [
  { id: 'public',   label: 'Perfil público',     icon: <Globe className="w-4 h-4" /> },
  { id: 'privacy',  label: 'Privacidad',          icon: <Eye className="w-4 h-4" /> },
  { id: 'security', label: 'Seguridad',           icon: <Shield className="w-4 h-4" /> },
  { id: 'personal', label: 'Datos personales',    icon: <Lock className="w-4 h-4" /> },
];

// ── HELPERS ─────────────────────────────────────────────────────────────────

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }> = ({ value, onChange, label, desc }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div className="flex-1">
      <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{label}</p>
      {desc && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{desc}</p>}
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-indigo-600' : 'bg-slate-200'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-5' : 'left-1'}`} />
    </button>
  </div>
);

const FieldRow: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{label}</label>
    {children}
    {hint && <p className="text-[9px] text-slate-300 font-medium">{hint}</p>}
  </div>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { prefix?: string }> = ({ prefix, className, ...props }) => (
  <div className="flex items-center bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden focus-within:border-indigo-400 focus-within:bg-white transition-all">
    {prefix && <span className="pl-4 text-sm font-medium text-slate-400 flex-shrink-0">{prefix}</span>}
    <input
      className={`flex-1 px-4 py-3 bg-transparent outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300 ${prefix ? 'pl-1' : ''} ${className || ''}`}
      {...props}
    />
  </div>
);

const TagInput: React.FC<{ tags: string[]; onChange: (tags: string[]) => void; placeholder?: string }> = ({ tags, onChange, placeholder }) => {
  const [input, setInput] = useState('');
  const add = () => {
    const clean = input.trim().toLowerCase().replace(/\s+/g, '_');
    if (!clean || tags.includes(clean)) { setInput(''); return; }
    onChange([...tags, clean]);
    setInput('');
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder || 'Añadir tag...'}
          className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:bg-white transition-all"
        />
        <button onClick={add} className="px-4 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-indigo-700 transition-colors">
          +
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wide">
              #{tag}
              <button onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:text-red-500 transition-colors">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const SaveButton: React.FC<{ saving: boolean; saved: boolean; onClick: () => void }> = ({ saving, saved, onClick }) => (
  <button
    onClick={onClick}
    disabled={saving}
    className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
      saved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'
    } disabled:opacity-50`}
  >
    {saving ? (
      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    ) : saved ? (
      <Check className="w-4 h-4" />
    ) : (
      <Save className="w-4 h-4" />
    )}
    {saved ? 'Guardado' : saving ? 'Guardando...' : 'Guardar cambios'}
  </button>
);

// ── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

const AccountSettings: React.FC = () => {
  const { profile, user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<AccountTab>('public');

  // ── Estado del perfil público ────────────────────────────
  const [username,    setUsername]    = useState('');
  const [bio,         setBio]         = useState('');
  const [interests,   setInterests]   = useState<UserInterests>({ categories: [], tags: [], preferredModules: [] });
  const [socials,     setSocials]     = useState<UserSocials>({});
  const [usernameOk,  setUsernameOk]  = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Estado privacidad ────────────────────────────────────
  const [showRealName, setShowRealName] = useState(false);
  const [preferences, setPreferences]   = useState<UserPreferences>({ emailNotifications: true, feedSortBy: 'recent', theme: 'light' });

  // ── Estado seguridad ─────────────────────────────────────
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [newEmail,    setNewEmail]    = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [securityMsg, setSecurityMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Estado datos personales ──────────────────────────────
  const [realName, setRealName] = useState('');

  // ── Save states ──────────────────────────────────────────
  const [saving, setSaving] = useState<AccountTab | null>(null);
  const [saved,  setSaved]  = useState<AccountTab | null>(null);

  // Inicializar desde perfil
  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username    || '');
    setBio(profile.bio              || '');
    setRealName(profile.realName    || '');
    setShowRealName(profile.showRealName ?? false);
    setInterests(profile.interests  || { categories: [], tags: [], preferredModules: [] });
    setSocials(profile.socials      || {});
    setPreferences(profile.preferences || { emailNotifications: true, feedSortBy: 'recent', theme: 'light' });
  }, [profile]);

  // Verificación de username con debounce
  useEffect(() => {
    if (!username || username === profile?.username) { setUsernameOk(null); return; }
    if (username.length < 3) { setUsernameOk(false); return; }
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    setCheckingUsername(true);
    usernameTimer.current = setTimeout(async () => {
      try {
        const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
        const snap = await getDocs(q);
        setUsernameOk(snap.empty);
      } catch { setUsernameOk(null); }
      finally { setCheckingUsername(false); }
    }, 600);
    return () => { if (usernameTimer.current) clearTimeout(usernameTimer.current); };
  }, [username, profile?.username]);

  const doSave = async (tab: AccountTab) => {
    setSaving(tab);
    try {
      if (tab === 'public') {
        const clean = username.toLowerCase().trim();
        await updateProfile({ username: clean || undefined, bio, interests, socials });
      } else if (tab === 'privacy') {
        await updateProfile({ showRealName, preferences });
      } else if (tab === 'personal') {
        await updateProfile({ realName });
      }
      setSaved(tab);
      setTimeout(() => setSaved(null), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const handlePasswordChange = async () => {
    const authInst = getAuth();
    const u = authInst.currentUser;
    if (!u || !u.email) return;
    if (!currentPwd || !newPwd) { setSecurityMsg({ type: 'err', text: 'Completa ambos campos.' }); return; }
    if (newPwd.length < 6) { setSecurityMsg({ type: 'err', text: 'La nueva contraseña debe tener al menos 6 caracteres.' }); return; }
    try {
      const cred = EmailAuthProvider.credential(u.email, currentPwd);
      await reauthenticateWithCredential(u, cred);
      await updatePassword(u, newPwd);
      setCurrentPwd(''); setNewPwd('');
      setSecurityMsg({ type: 'ok', text: 'Contraseña actualizada correctamente.' });
    } catch (err: any) {
      setSecurityMsg({ type: 'err', text: err.code === 'auth/wrong-password' ? 'Contraseña actual incorrecta.' : 'Error al cambiar contraseña.' });
    }
  };

  const handleEmailChange = async () => {
    const authInst = getAuth();
    const u = authInst.currentUser;
    if (!u || !u.email) return;
    if (!newEmail || !currentPwd) { setSecurityMsg({ type: 'err', text: 'Completa el correo nuevo y tu contraseña actual.' }); return; }
    try {
      const cred = EmailAuthProvider.credential(u.email, currentPwd);
      await reauthenticateWithCredential(u, cred);
      await updateEmail(u, newEmail);
      setNewEmail(''); setCurrentPwd('');
      setSecurityMsg({ type: 'ok', text: 'Correo actualizado. Revisa tu bandeja para verificarlo.' });
    } catch (err: any) {
      setSecurityMsg({ type: 'err', text: err.code === 'auth/wrong-password' ? 'Contraseña incorrecta.' : 'Error al actualizar correo.' });
    }
  };

  const toggleCategory = (id: string) => {
    setInterests(prev => ({
      ...prev,
      categories: prev.categories.includes(id)
        ? prev.categories.filter(c => c !== id)
        : [...prev.categories, id],
    }));
  };

  const toggleModule = (id: string) => {
    setInterests(prev => ({
      ...prev,
      preferredModules: prev.preferredModules.includes(id)
        ? prev.preferredModules.filter(m => m !== id)
        : [...prev.preferredModules, id],
    }));
  };

  const setSocial = (group: 'personal' | 'business', key: string, value: string) => {
    setSocials(prev => ({
      ...prev,
      [group]: { ...prev[group], [key]: value },
    }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500">

      {/* HEADER */}
      <header className="space-y-1 px-1">
        <h1 className="text-2xl md:text-4xl font-black text-slate-900 uppercase italic tracking-tighter">
          Ajustes de <span className="text-indigo-600">cuenta</span>
        </h1>
        <p className="text-sm text-slate-400 font-medium">Gestiona tu perfil, privacidad y seguridad.</p>
      </header>

      {/* TABS */}
      <nav className="flex gap-1 bg-white border border-slate-100 rounded-2xl p-1 shadow-sm overflow-x-auto scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ═══════════ TAB: PERFIL PÚBLICO ═══════════ */}
      {activeTab === 'public' && (
        <div className="space-y-5 animate-in fade-in">

          {/* Avatar + nombre */}
          <div className="bg-white rounded-[28px] border border-slate-100 p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-indigo-500" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Identidad pública</p>
            </div>
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-white shadow">
                {profile?.photoURL
                  ? <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                  : <User className="w-7 h-7 text-indigo-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{profile?.displayName}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">{profile?.email}</p>
                <p className="text-[9px] text-slate-300 mt-1">Foto de perfil gestionada por tu cuenta de Google.</p>
              </div>
            </div>

            <FieldRow label="Nombre de usuario (@)" hint="Mínimo 3 caracteres. Solo letras, números y guiones bajos.">
              <div className="relative">
                <Input
                  prefix="@"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="tu_username"
                  maxLength={30}
                />
                {username && username !== profile?.username && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                    ) : usernameOk === true ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : usernameOk === false ? (
                      <X className="w-3.5 h-3.5 text-rose-500" />
                    ) : null}
                  </div>
                )}
              </div>
              {username && usernameOk === false && !checkingUsername && (
                <p className="text-[10px] text-rose-500 font-bold">Username no disponible o muy corto.</p>
              )}
            </FieldRow>

            <FieldRow label="Biografía" hint={`${bio.length}/160 caracteres.`}>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 160))}
                rows={3}
                placeholder="Cuéntanos brevemente quién eres y a qué te dedicas..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:bg-white transition-all resize-none"
              />
            </FieldRow>
          </div>

          {/* Intereses */}
          <div className="bg-white rounded-[28px] border border-slate-100 p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Intereses · Personaliza tu feed</p>
            </div>

            <FieldRow label="Categorías">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {INTEREST_CATEGORIES.map(cat => {
                  const active = interests.categories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-wide transition-all ${
                        active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-indigo-200 hover:text-indigo-600'
                      }`}
                    >
                      <i className={`fa-solid ${cat.icon} text-xs`} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </FieldRow>

            <FieldRow label="Tags de interés" hint="Enter para añadir. Ej: streetwear, maquillaje, smartwatch">
              <TagInput
                tags={interests.tags}
                onChange={tags => setInterests(prev => ({ ...prev, tags }))}
                placeholder="ej: streetwear, skincare..."
              />
            </FieldRow>

            <FieldRow label="Módulos favoritos">
              <div className="flex flex-wrap gap-2">
                {PREFERRED_MODULES.map(mod => {
                  const active = interests.preferredModules.includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleModule(mod.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wide transition-all ${
                        active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-indigo-200'
                      }`}
                    >
                      {mod.icon} {mod.label}
                    </button>
                  );
                })}
              </div>
            </FieldRow>
          </div>

          {/* Redes sociales */}
          <div className="bg-white rounded-[28px] border border-slate-100 p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Globe2 className="w-4 h-4 text-indigo-500" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Redes sociales (opcionales)</p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Personal</p>
                {(['instagram', 'twitter', 'tiktok', 'linkedin'] as const).map(net => (
                  <FieldRow key={net} label={net.charAt(0).toUpperCase() + net.slice(1)}>
                    <Input prefix="@" value={socials.personal?.[net] || ''} onChange={e => setSocial('personal', net, e.target.value)} placeholder={`tu_${net}`} />
                  </FieldRow>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Negocio / Marca</p>
                <FieldRow label="Sitio web">
                  <Input value={socials.business?.website || ''} onChange={e => setSocial('business', 'website', e.target.value)} placeholder="https://tutienda.com" />
                </FieldRow>
                {(['instagram', 'facebook', 'linkedin'] as const).map(net => (
                  <FieldRow key={net} label={net.charAt(0).toUpperCase() + net.slice(1)}>
                    <Input prefix="@" value={socials.business?.[net] || ''} onChange={e => setSocial('business', net, e.target.value)} placeholder={`tu_marca_${net}`} />
                  </FieldRow>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <SaveButton saving={saving === 'public'} saved={saved === 'public'} onClick={() => doSave('public')} />
          </div>
        </div>
      )}

      {/* ═══════════ TAB: PRIVACIDAD ═══════════ */}
      {activeTab === 'privacy' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="bg-white rounded-[28px] border border-slate-100 p-6 space-y-1 divide-y divide-slate-50">
            <div className="flex items-center gap-2 pb-4">
              <Eye className="w-4 h-4 text-indigo-500" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Visibilidad</p>
            </div>

            <Toggle
              value={showRealName}
              onChange={setShowRealName}
              label="Mostrar nombre real en perfil público"
              desc="Si está activo, otros usuarios verán tu nombre real junto a tu @username."
            />

            <div className="pt-4 space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Orden del feed</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: 'recent',       label: 'Reciente',      desc: 'Lo más nuevo primero' },
                  { v: 'likes',        label: 'Popular',       desc: 'Por número de likes' },
                  { v: 'personalized', label: 'Para ti',       desc: 'Según tus intereses' },
                ] as const).map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => setPreferences(prev => ({ ...prev, feedSortBy: opt.v }))}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      preferences.feedSortBy === opt.v
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-indigo-200'
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-wide">{opt.label}</p>
                    <p className={`text-[9px] mt-0.5 ${preferences.feedSortBy === opt.v ? 'text-white/70' : 'text-slate-400'}`}>{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <Toggle
              value={preferences.emailNotifications}
              onChange={v => setPreferences(prev => ({ ...prev, emailNotifications: v }))}
              label="Notificaciones por email"
              desc="Recibe novedades, actualizaciones y ofertas de LUZ IA."
            />
          </div>

          <div className="flex justify-end">
            <SaveButton saving={saving === 'privacy'} saved={saved === 'privacy'} onClick={() => doSave('privacy')} />
          </div>
        </div>
      )}

      {/* ═══════════ TAB: SEGURIDAD ═══════════ */}
      {activeTab === 'security' && (
        <div className="space-y-5 animate-in fade-in">
          {securityMsg && (
            <div className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest ${
              securityMsg.type === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'
            }`}>
              {securityMsg.text}
            </div>
          )}

          <div className="bg-white rounded-[28px] border border-slate-100 p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-indigo-500" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cambiar contraseña</p>
            </div>
            <p className="text-[10px] text-slate-400">Solo disponible si iniciaste sesión con email y contraseña. Si usas Google, gestiona tu contraseña desde tu cuenta Google.</p>

            <FieldRow label="Contraseña actual">
              <div className="relative">
                <Input type={showPwd ? 'text' : 'password'} value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="••••••••" />
                <button onClick={() => setShowPwd(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FieldRow>

            <FieldRow label="Nueva contraseña" hint="Mínimo 6 caracteres.">
              <Input type={showPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="••••••••" />
            </FieldRow>

            <button
              onClick={handlePasswordChange}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
            >
              Actualizar contraseña
            </button>
          </div>

          <div className="bg-white rounded-[28px] border border-slate-100 p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <AtSign className="w-4 h-4 text-indigo-500" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cambiar correo electrónico</p>
            </div>

            <FieldRow label="Nuevo correo">
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="nuevo@correo.com" />
            </FieldRow>
            <FieldRow label="Contraseña actual (para confirmar)">
              <Input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="••••••••" />
            </FieldRow>
            <button
              onClick={handleEmailChange}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
            >
              Actualizar correo
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ TAB: DATOS PERSONALES ═══════════ */}
      {activeTab === 'personal' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="bg-white rounded-[28px] border border-slate-100 p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-indigo-500" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Información privada</p>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Estos datos son privados y no se muestran en tu perfil público a menos que lo habilites en la pestaña Privacidad.
            </p>

            <FieldRow label="Nombre real" hint="No visible públicamente a menos que actives 'Mostrar nombre real' en Privacidad.">
              <Input value={realName} onChange={e => setRealName(e.target.value)} placeholder="Tu nombre y apellido" />
            </FieldRow>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email de cuenta</p>
              <p className="text-sm font-bold text-slate-700">{profile?.email}</p>
              <p className="text-[9px] text-slate-300">Para cambiar el email ve a la pestaña Seguridad.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <SaveButton saving={saving === 'personal'} saved={saved === 'personal'} onClick={() => doSave('personal')} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSettings;
