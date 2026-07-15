import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const isAdminShell = () => {
  const cleanPath = window.location.pathname.replace(/\/+$/, '');
  return window.location.hash === '#/admin' || cleanPath.endsWith('/admin') || cleanPath.endsWith('/admin.html');
};

if ('serviceWorker' in navigator && import.meta.env.PROD && isAdminShell()) {
  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL || './';
    const serviceWorkerUrl = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}admin-sw.js`;
    navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
      console.warn('Thrift With D admin service worker registration failed.', error);
    });
  });
}