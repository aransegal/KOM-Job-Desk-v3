import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import VendorDetail from './pages/VendorDetail';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import Schedule from './pages/Schedule';
import VendorPortal from './pages/VendorPortal';
import VendorJobAction from './pages/VendorJobAction';
import InviteUser from './pages/InviteUser';
import Profile from './pages/Profile';
import Login from './pages/Login';
import AccessDenied from './components/AccessDenied';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { canAccessAdminOps, canAccessVendorPortal, canAccessInviteUsers, canAccessJobs } from '@/lib/permissions';

/** Renders children if checkFn(user) is true, otherwise shows AccessDenied */
function RoleGuard({ checkFn, children }) {
  const { data: user, isLoading } = useCurrentUser();
  if (isLoading) return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  );
  if (!checkFn(user)) return <AccessDenied />;
  return children;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Admin + Dispatcher only */}
        <Route path="/" element={<RoleGuard checkFn={canAccessAdminOps}><Dashboard /></RoleGuard>} />
        <Route path="/schedule" element={<RoleGuard checkFn={canAccessAdminOps}><Schedule /></RoleGuard>} />
        <Route path="/customers" element={<RoleGuard checkFn={canAccessAdminOps}><Customers /></RoleGuard>} />
        <Route path="/customers/:id" element={<RoleGuard checkFn={canAccessAdminOps}><CustomerDetail /></RoleGuard>} />
        <Route path="/vendors" element={<RoleGuard checkFn={canAccessAdminOps}><Vendors /></RoleGuard>} />
        <Route path="/vendors/:id" element={<RoleGuard checkFn={canAccessAdminOps}><VendorDetail /></RoleGuard>} />
        {/* Admin only */}
        <Route path="/invite-user" element={<RoleGuard checkFn={canAccessInviteUsers}><InviteUser /></RoleGuard>} />
        {/* Vendor only */}
        <Route path="/vendor-portal" element={<RoleGuard checkFn={canAccessVendorPortal}><VendorPortal /></RoleGuard>} />
        <Route path="/vendor-job/:id" element={<RoleGuard checkFn={canAccessVendorPortal}><VendorJobAction /></RoleGuard>} />
        {/* Jobs: admin, dispatcher only */}
        <Route path="/jobs" element={<RoleGuard checkFn={canAccessJobs}><Jobs /></RoleGuard>} />
        <Route path="/jobs/:id" element={<RoleGuard checkFn={canAccessJobs}><JobDetail /></RoleGuard>} />
        {/* Any authenticated user */}
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App