import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import type { AccountResponse, ProxyResponse, AccountCreate, ProxyCreate } from '../types'
import { 
  Plus, Edit, Trash2, Phone, Wifi, Loader2, Eye, EyeOff, 
  Send, Check, X, Settings, AlertCircle, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

const AccountModal = ({ 
  account, 
  onClose, 
  onSubmit, 
  proxies,
  loading 
}: { 
  account: AccountResponse | null
  onClose: () => void
  onSubmit: (data: AccountCreate) => Promise<void>
  proxies: ProxyResponse[]
  loading: boolean
}) => {
  const [formData, setFormData] = useState({
    api_id: '',
    api_hash: '',
    phone: '',
    proxy_id: '',
    daily_add_limit: 30,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState<'form' | 'code' | 'password'>('form')
  const [phoneCodeHash, setPhoneCodeHash] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (account) {
      setFormData({
        api_id: String(account.api_id),
        api_hash: account.api_hash,
        phone: account.phone,
        proxy_id: String(account.proxy_id || ''),
        daily_add_limit: account.daily_add_limit,
      })
    }
  }, [account])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      api_id: Number(formData.api_id),
      api_hash: formData.api_hash,
      phone: formData.phone,
      proxy_id: formData.proxy_id ? Number(formData.proxy_id) : undefined,
      daily_add_limit: formData.daily_add_limit,
    }
    await onSubmit(data)
  }

  const handleSendCode = async () => {
    try {
      const res = await api.post('/accounts/login/send-code', {
        phone: formData.phone,
        api_id: Number(formData.api_id),
        api_hash: formData.api_hash,
      })
      setPhoneCodeHash(res.data.phone_code_hash)
      setStep('code')
      toast.success('Code sent!')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send code')
    }
  }

  const handleVerifyCode = async () => {
    try {
      const res = await api.post('/accounts/login/verify-code', {
        phone: formData.phone,
        code,
        phone_code_hash: phoneCodeHash,
      })
      if (res.data.requires_password) {
        setStep('password')
      } else {
        toast.success('Account connected!')
        onClose()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Invalid code')
    }
  }

  const handleVerifyPassword = async () => {
    try {
      await api.post('/accounts/login/verify-password', {
        password,
        phone: formData.phone,
      })
      toast.success('Account connected!')
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Invalid password')
    }
  }

  if (step === 'code') {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
          <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Enter Code</h3>
              <button onClick={() => setStep('form')} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-600 mb-4">Enter the code sent to {formData.phone}</p>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl tracking-widest"
                maxLength={5}
                autoFocus
              />
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={handleVerifyCode}
                  disabled={loading || code.length !== 5}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  onClick={() => setStep('form')}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Resend
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'password') {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
          <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Two-Factor Authentication</h3>
              <button onClick={() => setStep('code')} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-600 mb-4">Enter your 2FA password</p>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <button
                onClick={handleVerifyPassword}
                disabled={loading || !password}
                className="mt-4 w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : 'Sign In'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold">{account ? 'Edit Account' : 'Add Account'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API ID</label>
              <input
                type="number"
                value={formData.api_id}
                onChange={(e) => setFormData({...formData, api_id: e.target.value})}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="123456"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Hash</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.api_hash}
                  onChange={(e) => setFormData({...formData, api_hash: e.target.value})}
                  required
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="abcdef123456..."
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <div className="flex space-x-2">
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  required
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+1234567890"
                />
                {!account && (
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={loading || !formData.api_id || !formData.api_hash || !formData.phone}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Send Code'}
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proxy (Optional)</label>
              <select
                value={formData.proxy_id}
                onChange={(e) => setFormData({...formData, proxy_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No proxy</option>
                {proxies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.host}:{p.port} ({p.proxy_type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Daily Add Limit</label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.daily_add_limit}
                onChange={(e) => setFormData({...formData, daily_add_limit: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : (account ? 'Save' : 'Add Account')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const ProxyModal = ({ 
  proxy, 
  onClose, 
  onSubmit, 
  loading 
}: { 
  proxy: ProxyResponse | null
  onClose: () => void
  onSubmit: (data: ProxyCreate) => Promise<void>
  loading: boolean
}) => {
  const [formData, setFormData] = useState({
    host: '',
    port: '',
    username: '',
    password: '',
    proxy_type: 'socks5',
  })

  useEffect(() => {
    if (proxy) {
      setFormData({
        host: proxy.host,
        port: String(proxy.port),
        username: proxy.username || '',
        password: '',
        proxy_type: proxy.proxy_type,
      })
    }
  }, [proxy])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData as ProxyCreate)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold">{proxy ? 'Edit Proxy' : 'Add Proxy'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({...formData, host: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="127.0.0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({...formData, port: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="1080"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.proxy_type}
                  onChange={(e) => setFormData({...formData, proxy_type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="socks5">SOCKS5</option>
                  <option value="http">HTTP</option>
                  <option value="mtproto">MTProto</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username (Optional)</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password (Optional)</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={proxy ? 'Leave empty to keep current' : ''}
              />
            </div>
            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : (proxy ? 'Save' : 'Add Proxy')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function Accounts() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<AccountResponse[]>([])
  const [proxies, setProxies] = useState<ProxyResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [accountModal, setAccountModal] = useState<AccountResponse | null>(null)
  const [proxyModal, setProxyModal] = useState<ProxyResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchData = async () => {
    try {
      const [accountsRes, proxiesRes] = await Promise.all([
        api.get('/accounts'),
        api.get('/accounts/proxies'),
      ])
      setAccounts(accountsRes.data)
      setProxies(proxiesRes.data)
    } catch (error) {
      toast.error('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const handleAccountSubmit = async (data: any) => {
    setSubmitting(true)
    try {
      if (accountModal) {
        await api.put(`/accounts/${accountModal.id}`, data)
        toast.success('Account updated')
      } else {
        await api.post('/accounts', data)
        toast.success('Account added')
      }
      setAccountModal(null)
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save account')
    } finally {
      setSubmitting(false)
    }
  }

  const handleProxySubmit = async (data: any) => {
    setSubmitting(true)
    try {
      if (proxyModal) {
        await api.put(`/accounts/proxies/${proxyModal.id}`, data)
        toast.success('Proxy updated')
      } else {
        await api.post('/accounts/proxies', data)
        toast.success('Proxy added')
      }
      setProxyModal(null)
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save proxy')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteAccount = async (id: number) => {
    if (!confirm('Are you sure you want to delete this account?')) return
    try {
      await api.delete(`/accounts/${id}`)
      toast.success('Account deleted')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete account')
    }
  }

  const handleDeleteProxy = async (id: number) => {
    if (!confirm('Are you sure you want to delete this proxy?')) return
    try {
      await api.delete(`/accounts/proxies/${id}`)
      toast.success('Proxy deleted')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete proxy')
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'flood_wait': return 'bg-yellow-100 text-yellow-800'
      case 'banned': return 'bg-red-100 text-red-800'
      case 'auth_required': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-500">Manage your Telegram accounts and proxies</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setProxyModal(null)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2"
          >
            <Wifi className="w-4 h-4" />
            <span>Add Proxy</span>
          </button>
          <button
            onClick={() => setAccountModal(null)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Phone className="w-4 h-4" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Telegram Accounts ({accounts.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Today's Adds</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Daily Limit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proxy</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Used</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Phone className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="font-mono text-sm">{account.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                    {account.api_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(account.status)}`}>
                      {account.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {account.adds_today} / {account.daily_add_limit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {account.daily_add_limit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {account.proxy_id ? `${account.proxy_id}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {account.last_used_at ? formatDistanceToNow(new Date(account.last_used_at), { addSuffix: true }) : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setAccountModal(account)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(account.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No accounts configured. Click "Add Account" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proxies Table */}
      <div className="bg-white shadow rounded-lg mt-6">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Proxies ({proxies.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host:Port</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {proxies.map((proxy) => (
                <tr key={proxy.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {proxy.host}:{proxy.port}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {proxy.proxy_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {proxy.username || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${proxy.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {proxy.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setProxyModal(proxy)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProxy(proxy.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {proxies.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No proxies configured. Click "Add Proxy" to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {accountModal !== null && (
        <AccountModal
          account={accountModal}
          onClose={() => setAccountModal(null)}
          onSubmit={handleAccountSubmit}
          proxies={proxies}
          loading={submitting}
        />
      )}
      {proxyModal !== null && (
        <ProxyModal
          proxy={proxyModal}
          onClose={() => setProxyModal(null)}
          onSubmit={handleProxySubmit}
          loading={submitting}
        />
      )}
    </div>
  )
}

// Need to import formatDistanceToNow
import { formatDistanceToNow } from 'date-fns'