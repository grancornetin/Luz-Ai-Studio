/**
 * PlannerOnboarding.tsx - Entrada principal para crear un plan estrategico.
 * Ruta: /planner/nuevo.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import GrowthPlannerMock from './components/GrowthPlannerMock';

const PlannerOnboarding: React.FC = () => {
  const navigate = useNavigate();

  return <GrowthPlannerMock onBack={() => navigate('/planner')} />;
};

export default PlannerOnboarding;
