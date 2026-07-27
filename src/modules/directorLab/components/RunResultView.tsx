import React from 'react';
import type { DirectorRun } from '../types';
import TraceSection from './TraceSection';
import CandidateList from './CandidateList';

const STATUS_LABEL: Record<string, string> = {
  ready: 'Listo',
  blocked: 'Bloqueado',
  needs_review: 'Necesita revisión'
};

const STATUS_COLOR: Record<string, string> = {
  ready: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-red-100 text-red-700',
  needs_review: 'bg-amber-100 text-amber-700'
};

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

const RunResultView: React.FC<{ run: DirectorRun }> = ({ run }) => {
  const domains = Object.keys(run.selections || {});

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_COLOR[run.status] || 'bg-slate-100'}`}>
          {STATUS_LABEL[run.status] || run.status}
        </span>
        <span className="text-xs text-slate-400 font-mono">{run.id}</span>
      </div>

      <TraceSection title="1. Resumen de la dirección" defaultOpen>
        <p>{(run.briefInterpretation as any)?.freeformBrief || JSON.stringify(run.briefInterpretation)}</p>
      </TraceSection>

      <TraceSection title="2. Bancos consultados">
        <ul className="space-y-1">
          {run.consultedBanks.map(bank => (
            <li key={bank.bankId} className="flex justify-between">
              <span>{bank.label}</span>
              <span className="text-xs text-slate-500">{JSON.stringify(bank.status)}</span>
            </li>
          ))}
        </ul>
      </TraceSection>

      <TraceSection title="3. Candidatos encontrados">
        {domains.map(domain => (
          <div key={domain} className="mb-3">
            <h4 className="font-semibold mb-1 capitalize">{domain}</h4>
            <CandidateList candidates={(run.candidates as any)[domain] || []} />
          </div>
        ))}
      </TraceSection>

      <TraceSection title="4. Selecciones por dominio" defaultOpen>
        <ul className="space-y-2">
          {domains.map(domain => {
            const selection = (run.selections as any)[domain];
            return (
              <li key={domain}>
                <span className="font-semibold capitalize">{domain}: </span>
                {selection ? (
                  <span>
                    <span className="font-mono text-xs">{selection.sourceBank}/{selection.sourceId}</span>
                    {selection.compatibilityReason && <span className="text-slate-500"> — {selection.compatibilityReason}</span>}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">sin selección</span>
                )}
              </li>
            );
          })}
        </ul>
      </TraceSection>

      <TraceSection title={`5. Descartes (${run.rejections?.length || 0})`}>
        <ul className="space-y-1 max-h-64 overflow-y-auto">
          {(run.rejections || []).map((rejection, index) => (
            <li key={index} className="text-xs">
              <span className="font-mono">{rejection.domain}/{rejection.sourceId}</span>: {rejection.reason}
            </li>
          ))}
        </ul>
      </TraceSection>

      <TraceSection title="6. Reglas y validaciones">
        <div className="space-y-2">
          <div>
            <h4 className="font-semibold">Reglas aplicadas</h4>
            <ul className="text-xs">
              {run.rulesApplied.map(rule => <li key={rule.ruleId}>{rule.ruleId} ({rule.domain})</li>)}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Validaciones</h4>
            <ul className="text-xs">
              {run.validations.map(v => (
                <li key={v.validatorId} className={v.passed ? 'text-emerald-600' : 'text-red-600'}>
                  {v.validatorId}: {v.passed ? 'OK' : v.blocks.join('; ')}
                </li>
              ))}
            </ul>
          </div>
          {run.conflicts.length > 0 && (
            <div>
              <h4 className="font-semibold text-red-600">Conflictos</h4>
              <ul className="text-xs">{run.conflicts.map((c, i) => <li key={i}>{c.description}</li>)}</ul>
            </div>
          )}
        </div>
      </TraceSection>

      <TraceSection title="7. Prompt positivo" defaultOpen>
        <p className="whitespace-pre-wrap">{run.positivePrompt || '(sin prompt — run needs_review)'}</p>
        {run.positivePrompt && (
          <button onClick={() => copyToClipboard(run.positivePrompt)} className="mt-2 text-xs px-2 py-1 border rounded hover:bg-slate-50">
            Copiar
          </button>
        )}
      </TraceSection>

      <TraceSection title="8. Prompt negativo" defaultOpen>
        <p className="whitespace-pre-wrap">{run.negativePrompt || '(sin prompt)'}</p>
        {run.negativePrompt && (
          <button onClick={() => copyToClipboard(run.negativePrompt)} className="mt-2 text-xs px-2 py-1 border rounded hover:bg-slate-50">
            Copiar
          </button>
        )}
      </TraceSection>

      {run.warnings.length > 0 && (
        <TraceSection title={`9. Advertencias (${run.warnings.length})`} defaultOpen>
          <ul className="text-amber-700 text-xs space-y-1">
            {run.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </TraceSection>
      )}

      <TraceSection title="10. Procedencia (provenance)">
        <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto">{JSON.stringify(run.provenance, null, 2)}</pre>
      </TraceSection>
    </div>
  );
};

export default RunResultView;
