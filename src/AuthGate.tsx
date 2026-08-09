import { useState, useEffect } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from '../firebase';
import { fetchFirebaseCollection } from '../lib/firebase';
import { Shield, LogIn, LogOut, AlertTriangle, UserCheck } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../types';

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'gopiv061606@gmail.com').trim().toLowerCase();

interface AuthGateProps {
  children: (user: User, handleSignOut: () => void, userProfile?: UserProfile | null) => React.ReactNode;
}

export const AuthGate = ({ children }: AuthGateProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const emailLower = (u.email || '').trim().toLowerCase();
        const isRootAdminEmail = emailLower === ADMIN_EMAIL;

        if (isRootAdminEmail) {
          // EXCLUSIVE ROOT ADMIN: Only gopiv061606@gmail.com (VITE_ADMIN_EMAIL) is Root Admin
          const rootProf: UserProfile = {
            id: u.uid,
            email: u.email || '',
            fullName: u.displayName || 'Root Admin',
            role: 'root_admin',
            isRootAdmin: true,
          };
          setUserProfile(rootProf);
          setAuthorized(true);
        } else {
          // Non-root users: Only allow access if Root Admin granted Sub-Admin or Instructor role in Firestore
          try {
            const allUsers = await fetchFirebaseCollection<UserProfile>('users');
            const match = allUsers.find(
              (p) => (p.email || '').trim().toLowerCase() === emailLower || p.id === u.uid
            );

            if (match && (match.role === 'admin' || match.role === 'instructor')) {
              setUserProfile(match);
              setAuthorized(true);
            } else {
              setUserProfile(match || null);
              setAuthorized(false);
            }
          } catch (err) {
            console.error('Error verifying user authorization:', err);
            setUserProfile(null);
            setAuthorized(false);
          }
        }
      } else {
        setUserProfile(null);
        setAuthorized(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message || 'Sign-in failed');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('Sign-out error:', err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="auth-gate-loading">
        <div className="auth-spinner" />
        <p>Verifying admin & instructor authorization...</p>
      </div>
    );
  }

  // Not signed in - show login
  if (!user) {
    return (
      <div className="auth-gate-container">
        <div className="auth-card">
          <div className="auth-logo">
            <Shield className="auth-logo-icon" />
          </div>
          <h1 className="auth-title">A2Z Portal</h1>
          <p className="auth-subtitle">Admin & Instructor Portal</p>
          <p className="auth-desc">Sign in with your authorized Google account to access your admin or instructor dashboard.</p>

          {error && (
            <div className="auth-error">
              <AlertTriangle className="auth-error-icon" />
              <span>{error}</span>
            </div>
          )}

          <button className="auth-btn-google" onClick={handleGoogleSignIn}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Sign in with Google</span>
          </button>

          <p className="auth-footnote">Authorized for Root Admins, Sub-Admins, and Instructors.</p>
        </div>
      </div>
    );
  }

  // Signed in but not authorized role
  if (!authorized) {
    return (
      <div className="auth-gate-container">
        <div className="auth-card">
          <div className="auth-logo auth-logo-denied">
            <AlertTriangle className="auth-logo-icon" />
          </div>
          <h1 className="auth-title">Access Denied</h1>
          <p className="auth-subtitle">Your account is registered as a Student or pending role assignment.</p>
          <div className="auth-user-info">
            <p>Signed in as: <strong>{user.email}</strong></p>
            <p className="text-xs mt-1 text-on-surface-variant">Current Role: <span className="font-bold capitalize">{userProfile?.role || 'Student'}</span></p>
          </div>
          <p className="auth-desc">To access the admin panel or instructor dashboard, please ask your Root Administrator to grant your account Sub-Admin or Instructor access in the Users tab.</p>
          <button className="auth-btn-signout" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // Authorized admin or instructor
  return <>{children(user, handleSignOut, userProfile)}</>;
};

export default AuthGate;
