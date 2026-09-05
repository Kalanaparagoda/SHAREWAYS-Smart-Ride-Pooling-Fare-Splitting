import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const { getToken } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = async () => {
    try {
      const token = await getToken()
      const res = await api.get('/api/auth/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(res.data.users || [])
    } catch (err) {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [getToken])

  const toggleUserStatus = async (uid, currentDisabled) => {
    const action = currentDisabled ? 'enable' : 'disable'
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return

    try {
      const token = await getToken()
      await api.post(`/api/auth/admin/users/${uid}/disable`, {
        disabled: !currentDisabled
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success(`User ${action}d successfully`)
      fetchUsers()
    } catch (err) {
      toast.error(`Failed to ${action} user`)
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 flex justify-center">
        <svg className="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Manage ShareWays users and system settings</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">User Management</h2>
          <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg">
            {users.length} Total Users
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.uid} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{u.display_name || 'Unnamed User'}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{u.uid}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700">{u.email || 'No email'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{u.phone || 'No phone'}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(u.creation_time).toLocaleDateString('en-LK')}
                    </td>
                    <td className="px-6 py-4">
                      {u.disabled ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.is_admin ? (
                        <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded">ADMIN</span>
                      ) : (
                        <button
                          onClick={() => toggleUserStatus(u.uid, u.disabled)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                            u.disabled
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-700 hover:bg-red-100'
                          }`}
                        >
                          {u.disabled ? 'Enable' : 'Suspend'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">Pending ID Verifications</h2>
          <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2.5 py-1 rounded-lg">
            {users.filter(u => u.verification_status === 'pending').length} Pending
          </span>
        </div>
        
        <div className="p-6">
          {users.filter(u => u.verification_status === 'pending').length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">No pending ID verifications.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.filter(u => u.verification_status === 'pending').map(u => (
                <div key={u.uid} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-100 h-48 flex items-center justify-center relative">
                    {u.idDocumentUrl ? (
                      <img src={u.idDocumentUrl} alt="ID Document" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-slate-400">No image available</span>
                    )}
                  </div>
                  <div className="p-4 bg-white">
                    <h3 className="font-bold text-slate-900">{u.display_name}</h3>
                    <p className="text-xs text-slate-500 mb-4">{u.email}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={async () => {
                          if(!window.confirm('Approve this ID?')) return;
                          try {
                            const token = await getToken();
                            await api.put(`/api/auth/admin/users/${u.uid}/verify`, { status: 'verified' }, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            toast.success('User verified');
                            fetchUsers();
                          } catch(err) {
                            toast.error('Verification failed');
                          }
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={async () => {
                          if(!window.confirm('Reject this ID?')) return;
                          try {
                            const token = await getToken();
                            await api.put(`/api/auth/admin/users/${u.uid}/verify`, { status: 'rejected' }, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            toast.success('User rejected');
                            fetchUsers();
                          } catch(err) {
                            toast.error('Rejection failed');
                          }
                        }}
                        className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold py-2 rounded-lg transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
