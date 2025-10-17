import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import NotificationContainer from './components/NotificationContainer';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Categories from './pages/Categories';
import Dashboard from './pages/Dashboard';
import DeveloperDashboard from './pages/DeveloperDashboard';
import DeveloperUsers from './pages/DeveloperUsers';
import Login from './pages/Login';
import POS from './pages/POS';
import Products from './pages/Products';
import RepairJobs from './pages/RepairJobs';
import Reports from './pages/Reports';
import Sales from './pages/Sales';
import ShopSettings from './pages/ShopSettings';
import UserManagement from './pages/UserManagement';
import Suppliers from './pages/Suppliers';

// Define protected route component
const ProtectedRoute = ({ children, role }: { children: React.ReactElement, role?: string }) => {
  const { user, loading } = useAuth();
  
  // If auth is still loading, show a loading indicator instead of redirecting
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }
  
  // If no user logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // If role is specified and user doesn't have required role, redirect to dashboard
  if (role && user.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Otherwise render the protected component
  return children;
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              {/* Default redirect */}
              <Route index element={<Navigate to="/dashboard" replace />} />
              
              {/* Developer routes */}
              <Route path="developer">
                <Route path="dashboard" element={
                  <ProtectedRoute role="developer">
                    <DeveloperDashboard />
                  </ProtectedRoute>
                } />
                <Route path="users" element={
                  <ProtectedRoute role="developer">
                    <DeveloperUsers />
                  </ProtectedRoute>
                } />
              </Route>
              
              {/* Regular user routes */}
              <Route path="dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="pos" element={
                <ProtectedRoute>
                  <POS />
                </ProtectedRoute>
              } />
              <Route path="products" element={
                <ProtectedRoute>
                  <Products />
                </ProtectedRoute>
              } />
              <Route path="categories" element={
                <ProtectedRoute>
                  <Categories />
                </ProtectedRoute>
              } />
              <Route path="suppliers" element={
                <ProtectedRoute>
                  <Suppliers />
                </ProtectedRoute>
              } />
           
              <Route path="repair-jobs" element={
                <ProtectedRoute>
                  <RepairJobs />
                </ProtectedRoute>
              } />
              <Route path="sales" element={
                <ProtectedRoute>
                  <Sales />
                </ProtectedRoute>
              } />
              <Route path="reports" element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              } />
              
              {/* Admin Routes */}
              <Route path="admin/shop" element={
                <ProtectedRoute role="admin">
                  <ShopSettings />
                </ProtectedRoute>
              } />
              <Route path="admin/users" element={
                <ProtectedRoute role="admin">
                  <UserManagement />
                </ProtectedRoute>
              } />
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <NotificationContainer />
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
