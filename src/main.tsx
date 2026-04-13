import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // <--- Esta línea conecta los estilos de Tailwind y los colores brand
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Seleccionamos el elemento root del index.html
const rootElement = document.getElementById('root');

// Verificación de seguridad para asegurar que el DOM está listo
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);