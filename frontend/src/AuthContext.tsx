import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: string;
  name: string;
  role: string;
  depots: string[];
}

interface RoleView {
  navItems: { label: string; path: string; icon: string }[];
  defaultRoute: string;
  hiddenWidgets: string[];
  readOnlyTables: string[];
}

const ROLE_VIEWS: Record<string, RoleView> = {
  procurement: {
    navItems: [
      { label: "Procurement Intelligence", path: "/procurement", icon: "Briefcase" },
      { label: "Supply Chain Risk", path: "/supply-chain", icon: "Globe" },
      { label: "Commodity Prices", path: "/commodity", icon: "TrendingUp" },
      { label: "Quality Dashboard", path: "/quality", icon: "CheckCircle" },
      { label: "Carbon Overview", path: "/carbon", icon: "Leaf" },
      { label: "Business Analytics", path: "/analytics", icon: "BarChart3" }
    ],
    defaultRoute: "/procurement",
    hiddenWidgets: ["maintenanceSchedule", "workOrderList", "technicianView"],
    readOnlyTables: ["fleetHealthSummary"]
  },
  maintenance: {
    navItems: [
      { label: "Fleet Health", path: "/fleet/health", icon: "Activity" },
      { label: "Maintenance Schedule", path: "/maintenance", icon: "Calendar" },
      { label: "Work Orders", path: "/maintenance/orders", icon: "Tool" },
      { label: "Parts Inventory", path: "/maintenance/parts", icon: "Box" },
      { label: "Mobile View", path: "/maintenance/mobile", icon: "Smartphone" },
      { label: "Business Analytics", path: "/analytics", icon: "BarChart3" }
    ],
    defaultRoute: "/fleet/health",
    hiddenWidgets: ["commodityPrices", "supplyChainMap", "carbonTracker"],
    readOnlyTables: ["procurementCosts"]
  },
  executive: {
    navItems: [
      { label: "Executive Dashboard", path: "/executive", icon: "PieChart" },
      { label: "Carbon & Net Zero", path: "/carbon", icon: "Leaf" },
      { label: "Fleet Overview", path: "/fleet/health", icon: "Activity" },
      { label: "Supply Chain Risk", path: "/supply-chain", icon: "Globe" },
      { label: "Business Analytics", path: "/analytics", icon: "BarChart3" }
    ],
    defaultRoute: "/executive",
    hiddenWidgets: [],
    readOnlyTables: ["*"]
  },
  admin: {
    navItems: [
      { label: "Executive Dashboard", path: "/executive", icon: "PieChart" },
      { label: "Fleet Health", path: "/fleet/health", icon: "Activity" },
      { label: "Maintenance Schedule", path: "/maintenance", icon: "Calendar" },
      { label: "Procurement", path: "/procurement", icon: "Briefcase" },
      { label: "Supply Chain", path: "/supply-chain", icon: "Globe" },
      { label: "Quality", path: "/quality", icon: "CheckCircle" },
      { label: "Carbon & Net Zero", path: "/carbon", icon: "Leaf" },
      { label: "Business Analytics", path: "/analytics", icon: "BarChart3" }
    ],
    defaultRoute: "/executive",
    hiddenWidgets: [],
    readOnlyTables: []
  }
};

interface AuthContextType {
  user: User | null;
  roleView: RoleView | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  switchRole: (role: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const switchRole = async (role: string) => {
    // For demo purposes, we automatically login with a demo account for that role
    const demoEmails: Record<string, string> = {
      procurement: 'procurement@demo.com',
      maintenance: 'maintenance@demo.com',
      executive: 'executive@demo.com',
      admin: 'admin@demo.com'
    };
    const email = demoEmails[role];
    if (email) {
      try {
        const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const res = await axios.post(`${BASE}/api/auth/login`, { email, password: 'password123' });
        login(res.data.access_token, res.data.user);
        window.location.href = ROLE_VIEWS[role].defaultRoute;
      } catch (e) {
        console.error("Failed to switch role", e);
      }
    }
  };

  const roleView = user && ROLE_VIEWS[user.role] ? ROLE_VIEWS[user.role] : null;

  return (
    <AuthContext.Provider value={{ user, roleView, login, logout, switchRole, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
