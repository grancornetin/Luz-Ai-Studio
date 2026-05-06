// Re-exporta el WizardStepper compartido adaptando los tipos específicos del wizard de producto.
import React from 'react';
import { WizardStepper as SharedWizardStepper } from '../../components/shared/WizardStepper';
import type { WizardStepDef, WizardStep } from './wizardTypes';

interface WizardStepperProps {
  steps: WizardStepDef[];
  current: WizardStep;
  onJump?: (step: WizardStep) => void;
}

export const WizardStepper: React.FC<WizardStepperProps> = ({ steps, current, onJump }) => (
  <SharedWizardStepper
    steps={steps.map(s => ({ id: String(s.id), label: s.label }))}
    current={current}
    onJump={onJump ? (n) => onJump(n as WizardStep) : undefined}
  />
);

export default WizardStepper;
