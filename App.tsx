
import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { LoadingOverlay } from './components/UI';
import { ProtectedRoute } from './components/ProtectedRoute';

// Lazy loading das páginas sem extensões
const Home = lazy(() => import('./pages/Home'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DiagnosticPage = lazy(() => import('./pages/DiagnosticPage'));
const ManualsPage = lazy(() => import('./pages/ManualsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const ChecklistPage = lazy(() => import('./pages/ChecklistPage'));

const queryClient = new QueryClient();

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Suspense fallback={<LoadingOverlay />}>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            
            <Route path="/" element={
              <ProtectedRoute children={<Home />} />
            } />
            
            <Route path="/dashboard" element={
              <ProtectedRoute children={<Dashboard />} />
            } />
            
            <Route path="/diagnostico" element={
              <ProtectedRoute children={<DiagnosticPage />} />
            } />
            
            <Route path="/manuais" element={
              <ProtectedRoute children={<ManualsPage />} />
            } />
            
            <Route path="/historico" element={
              <ProtectedRoute children={<HistoryPage />} />
            } />
            
            <Route path="/checklist" element={
              <ProtectedRoute children={<ChecklistPage />} />
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
};

export default App;