
import React, { useEffect, useState, PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { LoadingOverlay } from './UI';

interface ProtectedRouteProps {
  adminOnly?: boolean;
  allowedRoles?: Array<'admin' | 'gestor' | 'usuario'>;
}

export const ProtectedRoute: React.FC<PropsWithChildren<ProtectedRouteProps>> = ({ children, adminOnly = false, allowedRoles }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'gestor' | 'usuario' | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const user = await dataService.getCurrentUser();
      const role = await dataService.getCurrentUserRole();
      const effectiveRole = role ?? 'usuario';
      console.log('🔐 ProtectedRoute - User:', user?.email, 'Role:', effectiveRole, 'adminOnly:', adminOnly);
      setAuthenticated(!!user);
      setUserRole(effectiveRole);
      setLoading(false);
    };
    checkAuth();
  }, [location.pathname]);

  if (loading) return <LoadingOverlay />;

  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && userRole !== 'admin') {
    return <Navigate to="/" state={{ accessDenied: true }} replace />;
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return <Navigate to="/" state={{ accessDenied: true }} replace />;
  }

  return <>{children}</>;
};
