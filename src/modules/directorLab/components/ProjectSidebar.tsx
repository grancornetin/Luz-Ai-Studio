import React from 'react';
import type { DirectorLabProject, DirectorLabRecipe, DirectorLabCase } from '../types';

const ProjectSidebar: React.FC<{
  projects: DirectorLabProject[];
  recipes: DirectorLabRecipe[];
  cases: DirectorLabCase[];
  selectedProjectId: string | null;
  selectedRecipeId: string | null;
  selectedCaseId: string | null;
  onSelectProject: (id: string) => void;
  onSelectRecipe: (id: string) => void;
  onSelectCase: (id: string) => void;
}> = ({ projects, recipes, cases, selectedProjectId, selectedRecipeId, selectedCaseId, onSelectProject, onSelectRecipe, onSelectCase }) => {
  return (
    <div className="w-64 shrink-0 border-r border-slate-200 p-3 space-y-4 text-sm">
      <div>
        <h3 className="font-semibold text-xs uppercase text-slate-400 mb-1">Proyectos</h3>
        <ul>
          {projects.map(project => (
            <li key={project.id}>
              <button
                onClick={() => onSelectProject(project.id)}
                className={`w-full text-left px-2 py-1 rounded ${selectedProjectId === project.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'}`}
              >
                {project.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {selectedProjectId && (
        <div>
          <h3 className="font-semibold text-xs uppercase text-slate-400 mb-1">Recetas</h3>
          <ul>
            {recipes.map(recipe => (
              <li key={recipe.id}>
                <button
                  onClick={() => onSelectRecipe(recipe.id)}
                  className={`w-full text-left px-2 py-1 rounded ${selectedRecipeId === recipe.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'}`}
                >
                  {recipe.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {selectedRecipeId && (
        <div>
          <h3 className="font-semibold text-xs uppercase text-slate-400 mb-1">Casos</h3>
          <ul>
            {cases.map(caseItem => (
              <li key={caseItem.id}>
                <button
                  onClick={() => onSelectCase(caseItem.id)}
                  className={`w-full text-left px-2 py-1 rounded ${selectedCaseId === caseItem.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'}`}
                >
                  {caseItem.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ProjectSidebar;
