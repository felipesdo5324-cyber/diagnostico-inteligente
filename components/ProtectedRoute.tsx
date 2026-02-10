
import React, { useEffect, useState, PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { LoadingOverlay } from './UI';

// Fixed: Using React.FC with PropsWithChildren to explicitly handle children prop and resolve TypeScript issues at usage sites in App.tsx.
export const ProtectedRoute: React.FC<PropsWithChildren<{}>> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const user = await dataService.getCurrentUser();
      setAuthenticated(!!user);
      setLoading(false);
    };
    checkAuth();
  }, [location.pathname]);

  if (loading) return <LoadingOverlay />;

  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
