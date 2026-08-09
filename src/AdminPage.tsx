import { useState, useMemo } from 'react';
import {
  LayoutDashboard, BookOpen, GraduationCap, Users, MessageSquare, BarChart3, Award, LogOut, Shield, UserCheck, CreditCard
} from 'lucide-react';
import { Admin, Analytics, CertificateGenerator, PaymentsManager } from '../index';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../types';

export type AdminTab = 'overview' | 'courses' | 'internships' | 'users' | 'payments' | 'messages' | 'analytics' | 'certificates';

const allNavItems = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
  { id: 'courses' as const, label: 'Courses', icon: BookOpen },
  { id: 'internships' as const, label: 'Internships', icon: GraduationCap },
  { id: 'users' as const, label: 'Users', icon: Users },
  { id: 'payments' as const, label: 'Payments & Verification', icon: CreditCard },
  { id: 'messages' as const, label: 'Messages', icon: MessageSquare },
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  { id: 'certificates' as const, label: 'Certificates', icon: Award },
];

interface AdminPageProps {
  user?: User;
  userProfile?: UserProfile | null;
  onSignOut?: () => void;
}

export const AdminPage = ({ user, userProfile, onSignOut }: AdminPageProps) => {
  const role = userProfile?.role || 'root_admin';
  const isRoot = userProfile?.isRootAdmin || role === 'root_admin';
  const perms = userProfile?.adminPermissions;

  const allowedNavItems = useMemo(() => {
    if (isRoot) return allNavItems;

    if (role === 'instructor') {
      return allNavItems.filter((i) => i.id === 'courses' || i.id === 'internships' || i.id === 'messages');
    }

    if (role === 'admin') {
      return allNavItems.filter((i) => {
        if (i.id === 'payments' && perms?.viewPayments === false) return false;
        if (i.id === 'analytics' && perms?.viewAnalytics === false) return false;
        if (i.id === 'certificates' && perms?.issueCertificates === false) return false;
        if (i.id === 'users' && perms?.manageUsers === false) return false;
        return true;
      });
    }

    return allNavItems;
  }, [role, isRoot, perms]);

  const [activeTab, setActiveTab] = useState<AdminTab>(() => allowedNavItems[0]?.id || 'overview');

  const renderMain = () => {
    switch (activeTab) {
      case 'payments':
        return <PaymentsManager permissions={perms} />;
      case 'analytics':
        return <Analytics permissions={perms} />;
      case 'certificates':
        return <CertificateGenerator />;
      case 'overview':
      case 'courses':
      case 'internships':
      case 'users':
      case 'messages':
      default:
        return <Admin initialTab={activeTab} onTabChange={setActiveTab} userProfile={userProfile} />;
    }
  };

  return (
    <div className="admin-layout">
      <div className="admin-grid">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div className="sidebar-inner">
            {/* Admin user info */}
            {user && (
              <div className="sidebar-user">
                <div className="sidebar-avatar">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="sidebar-avatar-img" />
                  ) : (
                    <span>{user.displayName?.charAt(0) || user.email?.charAt(0) || 'A'}</span>
                  )}
                </div>
                <div className="sidebar-user-info min-w-0">
                  <p className="sidebar-user-name truncate">{user.displayName || userProfile?.fullName || 'User'}</p>
                  <p className="sidebar-user-email truncate">{user.email}</p>
                  <div className="mt-1">
                    {isRoot ? (
                      <span className="text-xs font-semibold text-primary">Root Admin</span>
                    ) : role === 'admin' ? (
                      <span className="text-xs font-semibold text-amber-400">Sub-Admin</span>
                    ) : role === 'instructor' ? (
                      <span className="text-xs font-semibold text-purple-400">Instructor</span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-400">Student</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="sidebar-divider" />

            <div className="sidebar-header">
              <h3>{isRoot ? 'Root Admin Console' : role === 'instructor' ? 'Instructor Portal' : 'Admin Console'}</h3>
              <p>{isRoot ? 'Unrestricted platform management' : role === 'instructor' ? 'Course & internship management' : 'Restricted admin management'}</p>
            </div>

            <nav className="sidebar-nav">
              {allowedNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                  >
                    <Icon className="sidebar-nav-icon" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {onSignOut && (
              <>
                <div className="sidebar-divider" />
                <button className="sidebar-signout-btn" onClick={onSignOut}>
                  <LogOut className="sidebar-nav-icon" />
                  <span>Sign Out</span>
                </button>
              </>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="admin-main">
          {/* Mobile navigation */}
          <div className="mobile-nav">
            <div className="mobile-nav-scroll">
              {allowedNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
                  >
                    <Icon className="mobile-nav-icon" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="admin-content">
            {renderMain()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
