import { Link, useLocation } from "wouter";
import { EmailLink } from "@/components/ContactLinks";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard, Users, Building2, Dumbbell, UserCheck,
  Package, CreditCard, ClipboardCheck, TrendingUp, ShoppingBag,
  Salad, MessageSquare, LogOut, ChevronRight, X, TimerReset, BarChart3
} from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: any;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: ["owner", "admin", "coach", "member", "dietitian"] },
  { label: "Branches", path: "/branches", icon: Building2, roles: ["owner"] },
  { label: "Members", path: "/members", icon: Users, roles: ["owner", "admin"] },
  { label: "Human Resources", path: "/coaches", icon: UserCheck, roles: ["owner", "admin"] },
  { label: "Classes", path: "/classes", icon: Dumbbell, roles: ["owner", "admin", "coach", "member"] },
  { label: "Packages", path: "/packages", icon: Package, roles: ["owner", "admin"] },
  { label: "Payments", path: "/payments", icon: CreditCard, roles: ["owner", "admin"] },
  { label: "PT Sessions", path: "/pt-sessions", icon: TimerReset, roles: ["owner", "admin", "coach"] },
  { label: "My PT Sessions", path: "/my-pt-sessions", icon: TimerReset, roles: ["member"] },
  { label: "Attendance", path: "/attendance", icon: ClipboardCheck, roles: ["owner", "admin"] },
  { label: "CRM Leads", path: "/leads", icon: TrendingUp, roles: ["owner", "admin"] },
  { label: "Diet Plans", path: "/diet-plans", icon: Salad, roles: ["owner", "admin", "dietitian"] },
  { label: "Products", path: "/products", icon: ShoppingBag, roles: ["owner", "admin"] },
  { label: "Messages", path: "/messages", icon: MessageSquare, roles: ["owner", "admin"] },
  { label: "Reports", path: "/reports", icon: BarChart3, roles: ["owner", "admin"] },
  { label: "Users", path: "/users", icon: Users, roles: ["owner", "admin"] },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  const filtered = navItems.filter(item => item.roles.includes(user.role));
  const roleLabel = user.role === "coach" ? "Personal Trainer" : user.role;

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-30 bg-black/55 md:hidden"
          onClick={onClose}
        />
      )}
      <aside className={`fixed left-0 top-0 z-40 flex h-screen w-72 max-w-[85vw] flex-col border-r border-white/10 bg-[#181818] transition-transform duration-200 md:w-64 md:max-w-none ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}>
        {/* Logo */}
        <div className="border-b border-white/10 px-5 py-5">
          <div className="mb-3 flex items-start justify-between md:mb-0">
            <div className="md:hidden text-xs uppercase tracking-[0.18em] text-white/40">Navigation</div>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-white/65 hover:bg-white/10 hover:text-white md:hidden">
              <X className="h-4 w-4" />
            </button>
          </div>
          <img
            src="/start-gym-logo.jpg"
            alt="Start Gym Living Right"
            className="h-16 w-auto rounded-2xl border border-white/10 bg-[#6b6b70] p-1.5 shadow-xl shadow-black/25"
          />
          <div>
            <div className="mt-3 text-base font-bold leading-tight text-white">Start Living Right Gym</div>
            <div className="text-xs capitalize text-[#f4b516]">{roleLabel}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          {filtered.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || location.startsWith(item.path + "/");
            const label = item.path === "/pt-sessions" && user.role === "coach" ? "PT Requests" : item.label;
            return (
              <Link key={item.path} href={item.path}>
                <div
                  onClick={onClose}
                  data-testid={`nav-${label.toLowerCase().replace(" ", "-")}`}
                  className={`sidebar-item ${isActive ? "active" : "text-white/65"}`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User profile & logout */}
        <div className="border-t border-white/10 px-3 pb-4 pt-2">
          <div className="px-3 py-2 mb-1">
            <div className="text-white text-sm font-medium truncate">{user.name}</div>
            <div className="text-white/45 text-xs truncate">
              <EmailLink email={user.email} className="text-white/45" />
            </div>
          </div>
          <button
            onClick={() => {
              onClose?.();
              logout();
            }}
            data-testid="button-logout"
            className="sidebar-item w-full text-white/65 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
