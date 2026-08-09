import React from 'react'
import AuthGate from './AuthGate'
import AdminPage from './AdminPage'

export default function App() {
  return (
    <AuthGate>
      {(user, handleSignOut, userProfile) => (
        <AdminPage user={user} userProfile={userProfile} onSignOut={handleSignOut} />
      )}
    </AuthGate>
  )
}
