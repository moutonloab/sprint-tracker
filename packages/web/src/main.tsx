import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { StorageProvider } from './context/StorageContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <StorageProvider>
        <App />
      </StorageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
