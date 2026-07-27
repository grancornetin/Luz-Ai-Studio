// DEPRECADO (Director Lab v2): esta UI React/panel de proyectos-casos-runs
// quedó reemplazada por modules/motor-de-imagenes-corregido-v2/director-lab.html
// (página standalone, sin login, sin Vite — ver DIRECTOR_LAB_README.md).
// Se deja el código sin borrar por si se necesita retomar el patrón de
// trazabilidad completa a futuro, pero no se mantiene activamente.
import React, { useEffect, useState, useCallback } from 'react';
import { directorLabClient } from './directorLabClient';
import type {
  DirectorLabProject, DirectorLabRecipe, DirectorLabCase, DirectorReference,
  DirectorRun, DirectorLabStatus, DirectorBrief
} from './types';
import ProjectSidebar from './components/ProjectSidebar';
import BriefForm from './components/BriefForm';
import ReferencesPanel from './components/ReferencesPanel';
import RunResultView from './components/RunResultView';
import EvaluationPanel from './components/EvaluationPanel';
import CompareView from './components/CompareView';
import BankStatusPanel from './components/BankStatusPanel';

type Tab = 'run' | 'results' | 'compare' | 'banks';

const EMPTY_BRIEF: DirectorBrief = { testName: '', freeformBrief: '' };

const DirectorLabModule: React.FC = () => {
  const [status, setStatus] = useState<DirectorLabStatus | null>(null);
  const [projects, setProjects] = useState<DirectorLabProject[]>([]);
  const [recipes, setRecipes] = useState<DirectorLabRecipe[]>([]);
  const [cases, setCases] = useState<DirectorLabCase[]>([]);
  const [references, setReferences] = useState<DirectorReference[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const [brief, setBrief] = useState<DirectorBrief>(EMPTY_BRIEF);
  const [currentRun, setCurrentRun] = useState<DirectorRun | null>(null);
  const [caseRuns, setCaseRuns] = useState<DirectorRun[]>([]);
  const [tab, setTab] = useState<Tab>('run');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareLeft, setCompareLeft] = useState<string>('');
  const [compareRight, setCompareRight] = useState<string>('');
  const [compareResult, setCompareResult] = useState<{ left: DirectorRun; right: DirectorRun } | null>(null);

  useEffect(() => {
    directorLabClient.getStatus().then(setStatus).catch(err => setError(err.message));
    directorLabClient.listProjects().then(r => setProjects(r.projects)).catch(err => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    directorLabClient.listRecipes(selectedProjectId).then(r => setRecipes(r.recipes)).catch(err => setError(err.message));
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedRecipeId) return;
    directorLabClient.listCases(selectedRecipeId).then(r => setCases(r.cases)).catch(err => setError(err.message));
  }, [selectedRecipeId]);

  const loadCase = useCallback((caseId: string) => {
    directorLabClient.getCase(caseId).then(record => {
      setBrief(record.brief || EMPTY_BRIEF);
      setCaseRuns(record.runs || []);
      setCurrentRun(record.runs && record.runs.length ? record.runs[record.runs.length - 1] : null);
    }).catch(err => setError(err.message));
    directorLabClient.listReferences(caseId).then(r => setReferences(r.references)).catch(err => setError(err.message));
  }, []);

  useEffect(() => {
    if (selectedCaseId) loadCase(selectedCaseId);
  }, [selectedCaseId, loadCase]);

  const handleRun = async () => {
    if (!selectedProjectId || !selectedRecipeId || !selectedCaseId) return;
    setRunning(true);
    setError(null);
    try {
      const output = await directorLabClient.runDirector({
        projectId: selectedProjectId,
        recipeId: selectedRecipeId,
        shotId: selectedCaseId,
        caseId: selectedCaseId,
        brief,
        references: references.map(ref => ({ referenceId: ref.id, role: ref.role, alias: ref.alias })),
        constraints: [],
        priorShots: caseRuns.map(run => ({ selections: run.selections })),
        previousRunId: currentRun?.id,
        options: { mode: 'ugc', traceLevel: 'full' }
      });
      setCurrentRun(output);
      setCaseRuns(prev => [...prev, output]);
      setTab('run');
    } catch (err: any) {
      setError(err.cause || err.message);
    } finally {
      setRunning(false);
    }
  };

  const handleAddReference = async (data: { role: any; alias: string; notes: string; assetDataUrl?: string }) => {
    if (!selectedCaseId) return;
    const created = await directorLabClient.createReference({ caseId: selectedCaseId, ...data });
    setReferences(prev => [...prev, created]);
  };

  const handleUploadResult = async (file: File) => {
    if (!currentRun) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await directorLabClient.uploadResult(currentRun.id, { assetDataUrl: dataUrl });
  };

  const handleCompare = async () => {
    if (!compareLeft || !compareRight) return;
    const result = await directorLabClient.compareRuns(compareLeft, compareRight);
    setCompareResult(result);
  };

  return (
    <div className="flex h-full min-h-[600px]">
      <ProjectSidebar
        projects={projects}
        recipes={recipes}
        cases={cases}
        selectedProjectId={selectedProjectId}
        selectedRecipeId={selectedRecipeId}
        selectedCaseId={selectedCaseId}
        onSelectProject={id => { setSelectedProjectId(id); setSelectedRecipeId(null); setSelectedCaseId(null); }}
        onSelectRecipe={id => { setSelectedRecipeId(id); setSelectedCaseId(null); }}
        onSelectCase={setSelectedCaseId}
      />

      <div className="flex-1 p-4 overflow-y-auto">
        <h1 className="text-lg font-bold mb-1">Director Lab</h1>
        <p className="text-xs text-slate-400 mb-4">
          Herramienta interna de diagnóstico — requiere que "node server.js" corra en modules/motor-de-imagenes-corregido-v2 (puerto 3131).
        </p>

        {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded mb-3">{error}</div>}

        {!selectedCaseId ? (
          <p className="text-slate-400 text-sm">Selecciona (o crea) un proyecto → receta → caso en la barra lateral.</p>
        ) : (
          <>
            <div className="flex gap-2 mb-4 border-b border-slate-200">
              {(['run', 'results', 'compare', 'banks'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-2 text-sm ${tab === t ? 'border-b-2 border-slate-900 font-semibold' : 'text-slate-400'}`}
                >
                  {{ run: 'Brief + Ejecutar', results: 'Resultados y evaluación', compare: 'Comparación', banks: 'Bancos' }[t]}
                </button>
              ))}
            </div>

            {tab === 'run' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <section>
                    <h2 className="font-semibold text-sm mb-2">Brief</h2>
                    <BriefForm brief={brief} onChange={setBrief} />
                  </section>
                  <section>
                    <h2 className="font-semibold text-sm mb-2">Referencias</h2>
                    <ReferencesPanel references={references} onAdd={handleAddReference} />
                  </section>
                  <button
                    onClick={handleRun}
                    disabled={running}
                    className="w-full py-2 bg-indigo-600 text-white rounded font-semibold disabled:opacity-40"
                  >
                    {running ? 'Ejecutando Director…' : 'Ejecutar Director'}
                  </button>
                </div>
                <div>
                  <h2 className="font-semibold text-sm mb-2">Resultado</h2>
                  {currentRun ? <RunResultView run={currentRun} /> : <p className="text-slate-400 text-sm">Aún no hay runs para este caso.</p>}
                </div>
              </div>
            )}

            {tab === 'results' && currentRun && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h2 className="font-semibold text-sm mb-2">Subir resultado generado</h2>
                  <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleUploadResult(e.target.files[0])} />
                </div>
                <div>
                  <h2 className="font-semibold text-sm mb-2">Evaluar</h2>
                  <EvaluationPanel onSubmit={data => directorLabClient.submitEvaluation(currentRun.id, data as any)} />
                </div>
              </div>
            )}

            {tab === 'compare' && (
              <div className="space-y-3">
                <div className="flex gap-2 items-end">
                  <select className="border rounded px-2 py-1 text-sm" value={compareLeft} onChange={e => setCompareLeft(e.target.value)}>
                    <option value="">Run izquierdo…</option>
                    {caseRuns.map(run => <option key={run.id} value={run.id}>{run.id}</option>)}
                  </select>
                  <select className="border rounded px-2 py-1 text-sm" value={compareRight} onChange={e => setCompareRight(e.target.value)}>
                    <option value="">Run derecho…</option>
                    {caseRuns.map(run => <option key={run.id} value={run.id}>{run.id}</option>)}
                  </select>
                  <button onClick={handleCompare} className="text-sm px-3 py-1 border rounded">Comparar</button>
                </div>
                {compareResult && <CompareView left={compareResult.left} right={compareResult.right} />}
              </div>
            )}

            {tab === 'banks' && <BankStatusPanel status={status} />}
          </>
        )}
      </div>
    </div>
  );
};

export default DirectorLabModule;
