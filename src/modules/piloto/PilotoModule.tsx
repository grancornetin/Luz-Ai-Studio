import React, { Suspense } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { FlowShell } from '../../components/shared/flow/FlowShell';
import { LargeTitle } from '../../components/shared/flow/primitives';
import { usePilotAccess } from './usePilotAccess';
import { HIBERNATE } from './hibernate';
import HoyScreen from './screens/HoyScreen';

// Ruta /mi-negocio: Hoy (inicio), /mi-negocio/marca y /mi-negocio/catalogo.
// Mi marca y Mi catálogo los entrega otro frente (screens/MiMarcaScreen.tsx y
// screens/MiCatalogoScreen.tsx, export con nombre, prop opcional `onDone`).
// Mientras no existan se muestra "Próximamente" sin romper el build.

type ScreenProps = { onDone?: () => void };
const screenFiles = import.meta.glob<Record<string, React.ComponentType<ScreenProps>>>('./screens/Mi*Screen.tsx');

const Soon: React.FC<ScreenProps & { title: string }> = ({ title }) => {
  const nav = useNavigate();
  return (
    <FlowShell title={title} leading={{ kind: 'back', onPress: () => nav('/mi-negocio') }}>
      <LargeTitle subtitle="Estamos terminando esta parte. Vuelve pronto.">Próximamente</LargeTitle>
    </FlowShell>
  );
};

function lazyScreen(file: string, exportName: string, title: string): React.LazyExoticComponent<React.ComponentType<ScreenProps>> {
  const loader = screenFiles[file];
  return React.lazy<React.ComponentType<ScreenProps>>(async () => {
    if (!loader) return { default: (props: ScreenProps) => <Soon {...props} title={title} /> };
    const mod = await loader();
    const C = mod[exportName] ?? (mod as any).default;
    return { default: C ?? ((props: ScreenProps) => <Soon {...props} title={title} />) };
  });
}

const MiMarca = lazyScreen('./screens/MiMarcaScreen.tsx', 'MiMarcaScreen', 'Mi marca');
const MiCatalogo = lazyScreen('./screens/MiCatalogoScreen.tsx', 'MiCatalogoScreen', 'Mi catálogo');

const Loading = (
  <div className="flex min-h-[50vh] items-center justify-center text-[color:var(--text-2)]"><Loader2 className="animate-spin" /></div>
);

const PilotoModule: React.FC = () => {
  const allowed = usePilotAccess();
  const nav = useNavigate();

  if (!allowed) {
    // Sin acceso: con la app hibernada no hay otro lugar al que ir (evita un bucle de redirecciones).
    if (!HIBERNATE) return <Navigate to="/dashboard" replace />;
    return (
      <FlowShell title="Mi negocio">
        <LargeTitle subtitle="Estamos preparando tu espacio. Cuando esté listo vas a verlo aquí mismo.">Mi negocio</LargeTitle>
      </FlowShell>
    );
  }

  const back = () => nav('/mi-negocio');
  return (
    <Suspense fallback={Loading}>
      <Routes>
        <Route index element={<HoyScreen />} />
        <Route path="marca" element={<MiMarca onDone={back} />} />
        <Route path="catalogo" element={<MiCatalogo onDone={back} />} />
        <Route path="*" element={<Navigate to="/mi-negocio" replace />} />
      </Routes>
    </Suspense>
  );
};

export default PilotoModule;
