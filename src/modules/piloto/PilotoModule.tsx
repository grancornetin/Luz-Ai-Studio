import React from 'react';
import { Navigate } from 'react-router-dom';
import { FlowShell } from '../../components/shared/flow/FlowShell';
import { LargeTitle } from '../../components/shared/flow/primitives';
import { usePilotAccess } from './usePilotAccess';

// Ruta /mi-negocio. W7 reemplaza el contenido por las 3 pantallas
// (Mi marca, Mi catálogo, Hoy); aquí solo queda el acceso y el marco.
const PilotoModule: React.FC = () => {
  const allowed = usePilotAccess();
  if (!allowed) return <Navigate to="/dashboard" replace />;

  return (
    <FlowShell title="Mi negocio">
      <LargeTitle>Mi negocio</LargeTitle>
    </FlowShell>
  );
};

export default PilotoModule;
