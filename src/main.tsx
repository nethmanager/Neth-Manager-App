import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AIProvider } from './contexts/AIContext';
import { UIProvider } from './contexts/UIContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <UIProvider>
        <AIProvider>
          <App />
        </AIProvider>
      </UIProvider>
    </BrowserRouter>
  </React.StrictMode>
);
