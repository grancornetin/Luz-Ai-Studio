import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LogOut, User as UserIcon, Menu, X, Search } from 'lucide-react';

// Vistas y Módulos
import Landing from './views/Landing';
import Dashboard from './views/Dashboard';
import CloningModule from './modules/CloningModule';
import ManualCreatorModule from './modules/ManualCreatorModule';
import ProductGeneratorModule from './modules/ProductGeneratorModule';
import AvatarLibrary from './components/AvatarLibrary';
import ContentStudioProModule from './modules/contentStudioPro/ContentStudioProModule';
import OutfitExtractorModule from './modules/outfitExtractor/OutfitExtractorModule';
import CloneImageModule from './modules/CloneImageModule';
import GenerationHistory from './views/GenerationHistory';
import PoliticaPrivacidad from './views/PoliticaPrivacidad';
import TerminosUso from './views/TerminosUso';
import Descargo from './views/Descargo';

// NUEVAS VISTAS PARA PROMPT LIBRARY
import PromptGalleryView from './views/PromptGalleryView';
import PromptStudioView from './views/PromptStudioView';

// PROYECTOS
import ProjectsList from './modules/projects/ProjectsList';
import ProjectDetail from './modules/projects/ProjectDetail';

// PRECIOS Y CRÉDITOS
import Pricing from './views/Pricing';
import BuyCredits from './views/BuyCredits';
import Contacto from './views/Contacto';
import AccountSettings from './views/AccountSettings';
import CheckoutSuccess from './views/CheckoutSuccess';
import CheckoutCancel from './views/CheckoutCancel';

// Servicios y Contexto
import { dbService } from './services/dbService';
import { AuthProvider, useAuth } from './modules/auth/AuthContext';
import { ModelSelectionProvider } from './contexts/ModelSelectionContext';
import AuthModal from './modules/auth/components/AuthModal';
import OnboardingWizard from './modules/auth/components/OnboardingWizard';
import AppAssistant from './components/AppAssistant';
import { WalletPill } from './components/shared/WalletPill';
import { MobileBottomNav } from './components/shared/MobileBottomNav';
import { GlobalSearchModal } from './components/shared/GlobalSearchModal';
import { AvatarProfile, ProductProfile } from './types';

const PLAN_STYLES: Record<string, { label: string; className: string }> = {
  free:    { label: 'Free',    className: 'bg-slate-100 text-slate-500' },
  starter: { label: 'Starter', className: 'bg-blue-100 text-blue-600' },
  pro:     { label: 'Pro',     className: 'bg-indigo-100 text-indigo-600' },
  studio:  { label: 'Studio',  className: 'bg-violet-100 text-violet-600' },
  admin:   { label: 'Admin',   className: 'bg-rose-100 text-rose-600' },
};

const MENU_GROUPS = [
  {
    label: 'Crear modelo digital',
    icon: 'fa-dna',
    items: [
      { path: '/crear/clonar',  label: 'Modelo desde fotos',  sublabel: 'Model DNA',     icon: 'fa-camera' },
      { path: '/crear/manual',  label: 'Modelo desde cero',   sublabel: 'Manual Creator', icon: 'fa-sliders' },
      { path: '/modelos',       label: 'Mis modelos',          sublabel: 'Biblioteca',    icon: 'fa-user-astronaut' },
    ]
  },
  {
    label: 'Generar contenido',
    icon: 'fa-wand-magic-sparkles',
    items: [
      { path: '/prompt-studio',   label: 'Generador con IA',    sublabel: 'Prompt Studio',  icon: 'fa-wand-magic-sparkles' },
      { path: '/prompt-gallery',  label: 'Galería de prompts',  sublabel: 'Prompt Gallery', icon: 'fa-images' },
      { path: '/studio-pro',      label: 'Contenido para redes',sublabel: 'UGC Studio',     icon: 'fa-mobile-screen-button' },
      { path: '/clonar',          label: 'Clonar escena',       sublabel: 'Scene Clone',    icon: 'fa-clone' },
    ]
  },
  {
    label: 'Herramientas',
    icon: 'fa-toolbox',
    items: [
      { path: '/outfit-extractor', label: 'Extraer prendas',  sublabel: 'Outfit Extractor', icon: 'fa-shirt' },
      { path: '/productos',         label: 'Foto de producto', sublabel: 'Product Studio',   icon: 'fa-gem' },
      { path: '/projects',          label: 'Proyectos',        sublabel: '',                 icon: 'fa-folder-open' },
    ]
  },
];


// ── ROUTE GUARD ──────────────────────────────────────────────────────────────
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-slate-50">
        <div className="flex flex-col items-center gap-4 opacity-40">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center animate-pulse">
            <i className="fa-solid fa-bolt text-white text-xl"></i>
          </div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// ── LOGIN WALL ────────────────────────────────────────────────────────────────
const LoginWall: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-indigo-600 rounded-[28px] flex items-center justify-center shadow-2xl shadow-indigo-200">
            <i className="fa-solid fa-bolt text-white text-3xl"></i>
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">LUZ IA</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Plataforma de creación publicitaria con IA</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-left">
          {[
            { icon: 'fa-wand-magic-sparkles', label: 'Generador con IA',    color: 'bg-indigo-50 text-indigo-600' },
            { icon: 'fa-dna',                 label: 'Crear modelo',         color: 'bg-purple-50 text-purple-600' },
            { icon: 'fa-clone',               label: 'Clonar escena',        color: 'bg-blue-50 text-blue-600' },
            { icon: 'fa-mobile-screen-button', label: 'Contenido para redes', color: 'bg-emerald-50 text-emerald-600' },
          ].map((item, i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.color}`}>
                <i className={`fa-solid ${item.icon} text-sm`}></i>
              </div>
              <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
          <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">🎁 20 créditos gratuitos al registrarte</p>
        </div>
        <button onClick={onOpen} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200">
          Ingresar / Crear cuenta
        </button>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link to="/privacidad" className="text-xs font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">Privacidad</Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link to="/terminos"    className="text-xs font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">Términos</Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link to="/descargo"    className="text-xs font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">Contacto</Link>
        </div>
      </div>
    </div>
  );
};

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: () => void; // cierra el sidebar al navegar
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, onNavigate }) => {
  const location = useLocation();
  const { profile, credits, isAdmin, signOut } = useAuth();
  const planStyle = PLAN_STYLES[credits.plan] || PLAN_STYLES.free;
  const isActive = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const navLink = (path: string, label: string, icon: string) => (
    <Link
      key={path}
      to={path}
      onClick={onNavigate}
      className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${isActive(path) ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
    >
      <i className={`fa-solid ${icon} text-xs`} />
      <span className="text-xs font-black uppercase tracking-widest">{label}</span>
    </Link>
  );

  return (
    <>
      {!collapsed && (
        <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-[2px] z-40 md:hidden" onClick={onToggle} />
      )}
      <aside className={`fixed md:sticky top-0 left-0 h-screen bg-white border-r border-slate-100 z-50 transition-all duration-500 overflow-hidden flex flex-col ${collapsed ? 'w-0 border-none' : 'w-80 shadow-2xl'}`}>
        <div className="p-8 pb-6 flex items-center justify-between flex-shrink-0">
          <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><i className="fa-solid fa-bolt" /></div>
            <h1 className="text-xl font-black text-slate-800 italic uppercase">LUZ IA</h1>
          </Link>
          <button onClick={onToggle} className="p-2 text-slate-400 hover:text-indigo-600"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-4">
          <div className="space-y-1">
            {navLink('/dashboard', 'Dashboard', 'fa-house')}
            {navLink('/historial', 'Mis Generaciones', 'fa-clock-rotate-left')}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 px-2">Cuenta</p>
            {navLink('/cuenta',      'Mi perfil',  'fa-user-pen')}
            {navLink('/pricing',     'Planes',     'fa-tag')}
            {navLink('/buy-credits', 'Recargar',   'fa-bolt')}
            {navLink('/contacto',    'Contacto',   'fa-envelope')}
          </div>

          {MENU_GROUPS.map(group => (
            <div key={group.label} className="space-y-1">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 px-2">{group.label}</p>
              {group.items.map(item => navLink(item.path, item.label, item.icon))}
            </div>
          ))}
        </div>

        {/* Footer con usuario + cerrar sesión siempre visible */}
        <div className="flex-shrink-0 p-5 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {profile?.photoURL
                  ? <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                  : <UserIcon size={18} className="text-indigo-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-800 uppercase truncate">{profile?.username || profile?.displayName || 'Usuario'}</p>
                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${planStyle.className}`}>
                  {isAdmin ? 'Admin' : planStyle.label}
                </span>
              </div>
            </div>
            <button
              onClick={() => { onNavigate(); signOut(); }}
              className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={13} /> Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Botón hamburguesa flotante cuando sidebar está cerrado */}
      <div className={`fixed top-5 left-5 z-[60] ${collapsed ? 'block' : 'hidden'}`}>
        <button onClick={onToggle} className="w-11 h-11 bg-white border border-slate-100 rounded-2xl shadow-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-all">
          <Menu size={20} />
        </button>
      </div>
    </>
  );
};


// ── APP CONTENT PRINCIPAL ──
const AppContent: React.FC = () => {
  const { user, isNewUser, markOnboardingDone } = useAuth();
  const [avatars, setAvatars] = useState<AvatarProfile[]>([]);
  const [products, setProducts] = useState<ProductProfile[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';

  // Cerrar sidebar automáticamente al cambiar de ruta
  const handleSidebarNavigate = () => setIsSidebarCollapsed(true);

  // Atajo global Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (user) setIsSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [a, p] = await Promise.all([dbService.getAvatars(), dbService.getProducts()]);
      setAvatars(a || []);
      setProducts(p || []);
    };
    load();
  }, [user]);

  const saveAvatar = async (avatar: AvatarProfile) => {
    await dbService.saveAvatar(avatar);
    setAvatars(prev => [avatar, ...prev]);
  };

  const saveProduct = async (product: ProductProfile) => {
    await dbService.saveProduct(product);
    setProducts(prev => [product, ...prev]);
  };

  // Páginas legales públicas (sin auth, con header propio)
  const legalRoutes = (
    <>
      <Route path="/privacidad"        element={<PoliticaPrivacidad />} />
      <Route path="/terminos"          element={<TerminosUso />} />
      <Route path="/descargo"          element={<Descargo />} />
      <Route path="/contacto"          element={<Contacto />} />
      <Route path="/checkout/success"  element={<CheckoutSuccess />} />
      <Route path="/checkout/cancel"   element={<CheckoutCancel />} />
    </>
  );

  // Si el usuario ya está autenticado, la landing redirige al dashboard
  const landingElement = user
    ? <Navigate to="/dashboard" replace />
    : (
      <>
        <Landing onOpenAuth={() => setIsAuthModalOpen(true)} />
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </>
    );

  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/" element={landingElement} />
      <Route path="/login" element={
        user ? <Navigate to="/dashboard" replace /> : (
          <>
            <LoginWall onOpen={() => setIsAuthModalOpen(true)} />
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
          </>
        )
      } />
      {legalRoutes}

      {/* App autenticada */}
      <Route path="/*" element={
        <ProtectedRoute>
          {/* overflow-x-hidden en el wrapper raíz elimina el horizontal overflow global */}
          <div className="flex min-h-screen bg-slate-50 overflow-x-hidden">
            {!isDashboard && (
              <div className="hidden md:block">
                <Sidebar
                  collapsed={isSidebarCollapsed}
                  onToggle={() => setIsSidebarCollapsed(p => !p)}
                  onNavigate={handleSidebarNavigate}
                />
              </div>
            )}
            <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
              {/* Barra superior derecha: búsqueda + wallet */}
              <div className="fixed top-5 right-5 z-[70] hidden md:flex items-center gap-2">
                {user && (
                  <button
                    onClick={() => setIsSearchOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all text-sm"
                  >
                    <Search size={14} className="text-slate-400" />
                    <span className="text-xs font-medium text-slate-400 italic">Buscar...</span>
                    <kbd className="text-[10px] bg-white text-slate-400 px-1.5 py-0.5 rounded-md border border-slate-200 font-bold leading-none ml-1">⌘K</kbd>
                  </button>
                )}
                <WalletPill />
              </div>
              <main className="flex-1 p-4 md:p-10 overflow-x-hidden pb-24 md:pb-10">
                <Routes>
                  <Route path="/dashboard"      element={<Dashboard />} />
                  <Route path="/historial"      element={<GenerationHistory />} />
                  <Route path="/modelos"        element={<AvatarLibrary avatars={avatars} />} />
                  <Route path="/crear/clonar"   element={<CloningModule onSave={saveAvatar} />} />
                  <Route path="/crear/manual"   element={<ManualCreatorModule onSave={saveAvatar} />} />
                  <Route path="/productos"      element={<ProductGeneratorModule saveProduct={saveProduct} products={products} />} />
                  <Route path="/prompt-studio"  element={<PromptStudioView />} />
                  <Route path="/prompt-gallery" element={<PromptGalleryView />} />
                  <Route path="/studio-pro"     element={<ContentStudioProModule />} />
                  <Route path="/outfit-extractor" element={<OutfitExtractorModule />} />
                  <Route path="/clonar"         element={<CloneImageModule />} />
                  <Route path="/pricing"        element={<Pricing />} />
                  <Route path="/buy-credits"    element={<BuyCredits />} />
                  <Route path="/cuenta"         element={<AccountSettings />} />
                  <Route path="/projects"        element={<ProjectsList />} />
                  <Route path="/projects/:id"   element={<ProjectDetail />} />
                  <Route path="/prompt-library" element={<Navigate to="/prompt-gallery" replace />} />
                  <Route path="*"               element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </main>
              <MobileBottomNav onSearchOpen={() => setIsSearchOpen(true)} />
            </div>
          </div>
          {isNewUser && <OnboardingWizard onDone={markOnboardingDone} />}
          <AppAssistant />
          <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </ProtectedRoute>
      } />
    </Routes>
  );
};

const App: React.FC = () => (
  <HashRouter>
    <AuthProvider>
      <ModelSelectionProvider>
        <AppContent />
      </ModelSelectionProvider>
    </AuthProvider>
  </HashRouter>
);

export default App;