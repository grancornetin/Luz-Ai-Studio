// @ts-nocheck
import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import '@repo/index.css';
import { qaState } from './mocks/qa';
import PilotoModule from '@repo/modules/piloto/PilotoModule';

qaState();
// Marco igual al de App.tsx (fondo, relleno de <main>) para ver el ancho real.
const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div data-app-frame className="flex min-h-screen bg-slate-50 overflow-x-hidden">
    <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
      <main data-app-main className="flex-1 p-4 md:py-10 md:pl-[88px] md:pr-24 overflow-x-hidden pb-24 md:pb-10">{children}</main>
    </div>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Frame>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/mi-negocio/*" element={<PilotoModule />} />
          <Route path="*" element={<Navigate to="/mi-negocio" replace />} />
        </Routes>
      </Suspense>
    </Frame>
  </BrowserRouter>,
);
