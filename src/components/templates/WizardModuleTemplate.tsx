import React from 'react';
import { WizardStepper, type WizardStepDef } from '../shared/WizardStepper';
import { WizardFooter } from '../shared/WizardFooter';

interface WizardModuleTemplateProps {
  title: string;
  subtitle: string;
  icon?: string;
  steps: (WizardStepDef & { component: React.ReactNode })[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  disabledContinue?: boolean;
  costInfo?: { cost: number; label?: string };
  loading?: boolean;
  previewArea: React.ReactNode;
  showStepper?: boolean;
}

export const WizardModuleTemplate: React.FC<WizardModuleTemplateProps> = ({
  title,
  subtitle,
  icon,
  steps,
  currentStep,
  onStepChange,
  onBack,
  onContinue,
  continueLabel = 'Continuar',
  disabledContinue = false,
  costInfo,
  loading = false,
  previewArea,
  showStepper = true,
}) => {
  const stepDefs: WizardStepDef[] = steps.map(({ id, label }) => ({ id, label }));
  const currentIndex = currentStep - 1;
  const currentStepComponent = steps[currentIndex]?.component ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* ── Columna izquierda: controles ── */}
      <div className="lg:col-span-4">
        <div className="bg-white rounded-[28px] md:rounded-[36px] shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[580px]">
          {/* Header */}
          <div className="px-6 md:px-8 pt-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-sm flex-shrink-0">
                  <i className={`fa-solid ${icon} text-base`} />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="t-display text-lg text-slate-900 truncate">{title}</h2>
                <p className="t-meta mt-0.5 truncate">{subtitle}</p>
              </div>
            </div>
          </div>

          {/* Stepper */}
          {showStepper && (
            <WizardStepper
              steps={stepDefs}
              current={currentStep}
              onJump={onStepChange}
            />
          )}

          {/* Contenido del paso actual */}
          <div className="flex-1 overflow-auto">
            {currentStepComponent}
          </div>

          {/* Footer */}
          <WizardFooter
            onBack={onBack}
            onContinue={onContinue}
            continueLabel={continueLabel}
            disabled={disabledContinue}
            costInfo={costInfo}
            loading={loading}
          />
        </div>
      </div>

      {/* ── Columna derecha: preview ── */}
      <div className="lg:col-span-8">
        {previewArea}
      </div>
    </div>
  );
};

export default WizardModuleTemplate;
