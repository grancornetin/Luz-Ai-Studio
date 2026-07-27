import React from 'react';
import type { DirectorBrief } from '../types';

const FIELD_LABELS: Array<[keyof DirectorBrief, string]> = [
  ['testName', 'Nombre de la prueba'],
  ['narrativeGoal', 'Objetivo narrativo'],
  ['photodumpStage', 'Etapa del Photodump'],
  ['contentType', 'Tipo de contenido'],
  ['desiredLocation', 'Ubicación deseada'],
  ['timeOfDay', 'Momento del día'],
  ['captureMechanism', 'Mecanismo de captura (o auto)'],
  ['desiredFraming', 'Encuadre deseado (o auto)']
];

const BriefForm: React.FC<{ brief: DirectorBrief; onChange: (brief: DirectorBrief) => void }> = ({ brief, onChange }) => {
  const setField = (field: keyof DirectorBrief, value: string) => onChange({ ...brief, [field]: value });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {FIELD_LABELS.map(([field, label]) => (
          <div key={field}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
            <input
              className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
              value={(brief[field] as string) || ''}
              onChange={e => setField(field, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Restricciones particulares</label>
        <textarea
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
          rows={2}
          value={brief.constraintsFreeText || ''}
          onChange={e => setField('constraintsFreeText', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Editor de brief libre</label>
        <textarea
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
          rows={4}
          value={brief.freeformBrief || ''}
          onChange={e => setField('freeformBrief', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Notas del evaluador</label>
        <textarea
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
          rows={2}
          value={brief.evaluatorNotes || ''}
          onChange={e => setField('evaluatorNotes', e.target.value)}
        />
      </div>
    </div>
  );
};

export default BriefForm;
