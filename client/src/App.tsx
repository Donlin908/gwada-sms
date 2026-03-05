import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import Home from "@/pages/home";
import Numbers from "@/pages/numbers";
import Messages from "@/pages/messages";
import MessagesList from "@/pages/messages-list";
import Payment from "@/pages/payment";
import PaymentSuccess from "@/pages/payment-success";
import PaymentCancel from "@/pages/payment-cancel";
import Auth from "@/pages/auth";
import VerifyEmail from "@/pages/verify-email";
import Dashboard from "@/pages/dashboard";
import Admin from "@/pages/admin";
import MentionsLegales from "@/pages/mentions-legales";
import PolitiqueConfidentialite from "@/pages/politique-confidentialite";
import CGU from "@/pages/cgu";
import Contact from "@/pages/contact";
import Maintenance from "@/pages/maintenance";
import NotFound from "@/pages/not-found";

function Router() {
  const [location] = useLocation();
  const isAdminRoute = location === "/admin";

  const { data: status } = useQuery<{ maintenance: boolean }>({
    queryKey: ["/api/status"],
    refetchInterval: 30000,
    staleTime: 15000,
  });

  if (status?.maintenance && !isAdminRoute) {
    return <Maintenance />;
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/numbers" component={Numbers} />
      <Route path="/messages/list" component={MessagesList} />
      <Route path="/messages/:id" component={Messages} />
      <Route path="/payment/success" component={PaymentSuccess} />
      <Route path="/payment/cancel" component={PaymentCancel} />
      <Route path="/payment/:numberId" component={Payment} />
      <Route path="/auth" component={Auth} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/admin" component={Admin} />
      <Route path="/mentions-legales" component={MentionsLegales} />
      <Route path="/politique-confidentialite" component={PolitiqueConfidentialite} />
      <Route path="/cgu" component={CGU} />
      <Route path="/contact" component={Contact} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
