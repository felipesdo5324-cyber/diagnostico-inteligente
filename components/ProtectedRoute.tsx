
import React, { useEffect, useState, PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { LoadingOverlay } from './UI';

interface ProtectedRouteProps {
  adminOnly?: boolean;
}

export const ProtectedRoute: React.FC<PropsWithChildren<ProtectedRouteProps>> = ({ children, adminOnly = false }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();

  const ADMIN_EMAILS = ['felipe.sdo17@gmail.com'];

  useEffect(() => {
    const checkAuth = async () => {
      const user = await dataService.getCurrentUser();
      setAuthenticated(!!user);
      setIsAdmin(!!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
      setLoading(false);
    };
    checkAuth();
  }, [location.pathname]);

  if (loading) return <LoadingOverlay />;

  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" state={{ accessDenied: true }} replace />;
  }

  return <>{children}</>;
};
