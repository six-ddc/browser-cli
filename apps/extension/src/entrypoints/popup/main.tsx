import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- root element always exists in popup.html
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
