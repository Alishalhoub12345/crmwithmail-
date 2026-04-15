import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Branches from "@/pages/Branches";
import Members from "@/pages/Members";
import Coaches from "@/pages/Coaches";
import Classes from "@/pages/Classes";
import Packages from "@/pages/Packages";
import Payments from "@/pages/Payments";
import PtSessions from "@/pages/PtSessions";
import Attendance from "@/pages/Attendance";
import Leads from "@/pages/Leads";
import Products from "@/pages/Products";
import Users from "@/pages/Users";
import DietPlans from "@/pages/DietPlans";
import Messages from "@/pages/Messages";
import Reports from "@/pages/Reports";

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType; roles?: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Redirect to="/login" />;
  if (roles && !roles.includes(user.role)) return <Redirect to="/dashboard" />;
  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">{user ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}</Route>
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/branches"><ProtectedRoute component={Branches} roles={["owner"]} /></Route>
      <Route path="/members"><ProtectedRoute component={Members} roles={["owner", "admin"]} /></Route>
      <Route path="/coaches"><ProtectedRoute component={Coaches} roles={["owner", "admin"]} /></Route>
      <Route path="/classes"><ProtectedRoute component={Classes} /></Route>
      <Route path="/packages"><ProtectedRoute component={Packages} roles={["owner", "admin"]} /></Route>
      <Route path="/payments"><ProtectedRoute component={Payments} roles={["owner", "admin"]} /></Route>
      <Route path="/pt-sessions"><ProtectedRoute component={PtSessions} roles={["owner", "admin", "coach"]} /></Route>
      <Route path="/attendance"><ProtectedRoute component={Attendance} /></Route>
      <Route path="/leads"><ProtectedRoute component={Leads} roles={["owner", "admin"]} /></Route>
      <Route path="/products"><ProtectedRoute component={Products} roles={["owner", "admin"]} /></Route>
      <Route path="/users"><ProtectedRoute component={Users} roles={["owner"]} /></Route>
      <Route path="/diet-plans"><ProtectedRoute component={DietPlans} /></Route>
      <Route path="/messages"><ProtectedRoute component={Messages} roles={["owner", "admin"]} /></Route>
      <Route path="/reports"><ProtectedRoute component={Reports} roles={["owner", "admin"]} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
