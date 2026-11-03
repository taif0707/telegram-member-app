import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import type { SourceChannelResponse, TargetChannelResponse, AccountResponse, ScrapeRequest } from '../types'
import { 
  Plus, Edit, Trash2, Hash, Search, Loader2, Download, 
  ExternalLink, Copy, Check, AlertCircle, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

const ChannelModal = ({ 
  channel, 
  type,
  accounts,
  onClose, 
  onSubmit, 
  loading 
}: { 
  channel: (SourceChannelResponse | TargetChannelResponse) | null
  type: 'source' | 'target'
  accounts: AccountResponse[]
  onClose: () => void
  onSubmit: (data: any) => Promise<void>
  loading: boolean
}) => {
  const [formData, setFormData] = useState({
    channel_id: '',
    account_id: '',
    username: '',
    title: '',
    max_per_day: 30,
  })
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    if (channel) {
      setFormData({
        channel_id: String(channel.channel_id),
        account_id: String(channel.account_id),
        username: channel.username || '',
        title: channel.title,
        max_per_day: 'max_per_day' in channel ? channel.max_per_day : 30,
      })
    }
  }, [channel])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      channel_id: Number(formData.channel_id),
      account_id: Number(formData.account_id),
      username: formData.username || undefined,
      title: formData.title,
      ...(type === 'target' && { max_per_day: Number(formData.max_per_day) }),
    }
    await onSubmit(data)
  }

  const handleResolve = async () => {
    if (!formData.channel_id || !formData.account_id) {
      toast.error('Please enter Channel ID and select Account')
      return
    }
    setResolving(true)
    try {
      const account = accounts.find(a => a.id === Number(formData.account_id))
      if (!account) throw new Error('Account not found')
      
      const res = await api.get(`/accounts/${account.id}/resolve`, {
        params: { entity: formData.channel_id }
      })
      
      if (res.data.title) setFormData(prev => ({ ...prev, title: res.data.title }))
      if (res.data.username) setFormData(prev => ({ ...prev, username: res.data.username }))
      if (res.data.access_hash) setFormData(prev => ({ ...prev, access_hash: res.data.access_hash }))
      
      toast.success('Channel resolved!')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to resolve channel')
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              {channel ? `Edit ${type} Channel` : `Add ${type} Channel`}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
              <select
                value={formData.account_id}
                onChange={(e) => setFormData({...formData, account_id: e.target.value})}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.phone} ({a.status})</option>
                ))}
              </select>
            </div>
            <div className="flex space-x-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel ID / Username</label>
                <input
                  type="text"
                  value={formData.channel_id}
                  onChange={(e) => setFormData({...formData, channel_id: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="-1001234567890 or @channelname"
                />
              </div>
              <button
                type="button"
                onClick={handleResolve}
                disabled={resolving || !formData.channel_id || !formData.account_id}
                className="mt-6 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap flex items-center space-x-1"
              >
                <Search className="w-4 h-4" />
                <span>Resolve</span>
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username (Optional)</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="@channelusername"
              />
            </div>
            {type === 'target' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Adds Per Day</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.max_per_day}
                  onChange={(e) => setFormData({...formData, max_per_day: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : (channel ? 'Save' : 'Add Channel')}
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

const ScrapeModal = ({ 
  channel, 
  accounts,
  onClose, 
  onSubmit, 
  loading 
}: { 
  channel: SourceChannelResponse
  accounts: AccountResponse[]
  onClose: () => void
  onSubmit: (data: ScrapeRequest) => Promise<void>
  loading: boolean
}) => {
  const [formData, setFormData] = useState({
    source_channel_id: channel.id,
    account_id: channel.account_id,
    limit: '',
    offset: 0,
    filter_usernames_only: false,
    filter_recent_activity: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      source_channel_id: formData.source_channel_id,
      account_id: formData.account_id || undefined,
      limit: formData.limit ? Number(formData.limit) : undefined,
      offset: formData.offset,
      filter_usernames_only: formData.filter_usernames_only,
      filter_recent_activity: formData.filter_recent_activity,
    }
    await onSubmit(data)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold">Scrape Members: {channel.title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
              <select
                value={formData.account_id}
                onChange={(e) => setFormData({...formData, account_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Use channel's account</option>
                {accounts.filter(a => a.status === 'active').map((a) => (
                  <option key={a.id} value={a.id}>{a.phone}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Limit (Optional)</label>
              <input
                type="number"
                min="1"
                value={formData.limit}
                onChange={(e) => setFormData({...formData, limit: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Leave empty for all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Offset</label>
              <input
                type="number"
                min="0"
                value={formData.offset}
                onChange={(e) => setFormData({...formData, offset: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.filter_usernames_only}
                  onChange={(e) => setFormData({...formData, filter_usernames_only: e.target.checked})}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Only members with usernames</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.filter_recent_activity}
                  onChange={(e) => setFormData({...formData, filter_recent_activity: e.target.checked})}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Only recently active members</span>
              </label>
            </div>
            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : 'Start Scraping'}
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

export default function Channels() {
  const [sourceChannels, setSourceChannels] = useState<SourceChannelResponse[]>([])
  const [targetChannels, setTargetChannels] = useState<TargetChannelResponse[]>([])
  const [accounts, setAccounts] = useState<AccountResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'source' | 'target'>('source')
  const [channelModal, setChannelModal] = useState<SourceChannelResponse | TargetChannelResponse | null>(null)
  const [scrapeModal, setScrapeModal] = useState<SourceChannelResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchData = async () => {
    try {
      const [sourcesRes, targetsRes, accountsRes] = await Promise.all([
        api.get('/channels/source'),
        api.get('/channels/target'),
        api.get('/accounts'),
      ])
      setSourceChannels(sourcesRes.data)
      setTargetChannels(targetsRes.data)
      setAccounts(accountsRes.data)
    } catch (error) {
      toast.error('Failed to load channels')
    } finally {
      setLoading(false)
    }
  }

  const handleSourceSubmit = async (data: any) => {
    setSubmitting(true)
    try {
      if (channelModal && 'last_scraped_at' in channelModal) {
        await api.put(`/channels/source/${channelModal.id}`, data)
        toast.success('Source channel updated')
      } else {
        await api.post('/channels/source', data)
        toast.success('Source channel added')
      }
      setChannelModal(null)
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save channel')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTargetSubmit = async (data: any) => {
    setSubmitting(true)
    try {
      if (channelModal && 'max_per_day' in channelModal) {
        await api.put(`/channels/target/${channelModal.id}`, data)
        toast.success('Target channel updated')
      } else {
        await api.post('/channels/target', data)
        toast.success('Target channel added')
      }
      setChannelModal(null)
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save channel')
    } finally {
      setSubmitting(false)
    }
  }

  const handleScrapeSubmit = async (data: any) => {
    setSubmitting(true)
    try {
      await api.post(`/channels/source/${data.source_channel_id}/scrape`, data)
      toast.success('Scraping started')
      setScrapeModal(null)
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to start scraping')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSource = async (id: number) => {
    if (!confirm('Delete this source channel?')) return
    try {
      await api.delete(`/channels/source/${id}`)
      toast.success('Source channel deleted')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete')
    }
  }

  const handleDeleteTarget = async (id: number) => {
    if (!confirm('Delete this target channel?')) return
    try {
      await api.delete(`/channels/target/${id}`)
      toast.success('Target channel deleted')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete')
    }
  }

  const handleGetInviteLink = async (channel: TargetChannelResponse) => {
    try {
      const res = await api.post(`/channels/target/${channel.id}/invite-link`)
      toast.success('Invite link generated')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to get invite link')
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const channels = activeTab === 'source' ? sourceChannels : targetChannels
  const handleChannelSubmit = activeTab === 'source' ? handleSourceSubmit : handleTargetSubmit
  const handleDelete = activeTab === 'source' ? handleDeleteSource : handleDeleteTarget

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Channels</h1>
          <p className="text-gray-500">Manage source and target channels</p>
        </div>
        <button
          onClick={() => setChannelModal(null)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add {activeTab === 'source' ? 'Source' : 'Target'} Channel</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('source')}
              className={`px-6 py-4 border-b-2 font-medium text-sm ${
                activeTab === 'source' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Source Channels <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">{sourceChannels.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('target')}
              className={`px-6 py-4 border-b-2 font-medium text-sm ${
                activeTab === 'target' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Target Channels <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">{targetChannels.length}</span>
            </button>
          </nav>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
                {activeTab === 'target' && (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Daily Limit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Today's Adds</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invite Link</th>
                  </>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Scraped</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {channels.map((channel) => (
                <tr key={channel.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Hash className="w-5 h-5 text-gray-400 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{channel.title}</p>
                        <p className="text-xs text-gray-500 font-mono">ID: {channel.channel_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {channel.username ? `@${channel.username}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {accounts.find(a => a.id === channel.account_id)?.phone || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {channel.total_members}
                  </td>
                  {activeTab === 'target' && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(channel as TargetChannelResponse).max_per_day}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(channel as TargetChannelResponse).adds_today}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(channel as TargetChannelResponse).invite_link ? (
                          <div className="flex items-center space-x-2">
                            <a 
                              href={(channel as TargetChannelResponse).invite_link!} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleGetInviteLink(channel as TargetChannelResponse)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Refresh invite link"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleGetInviteLink(channel as TargetChannelResponse)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Generate
                          </button>
                        )}
                      </td>
                    </>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${channel.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {channel.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {channel.last_scraped_at ? formatDistanceToNow(new Date(channel.last_scraped_at), { addSuffix: true }) : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {activeTab === 'source' && (
                        <button
                          onClick={() => setScrapeModal(channel)}
                          className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                          <Download className="w-3 h-3 inline mr-1" />
                          Scrape
                        </button>
                      )}
                      <button
                        onClick={() => setChannelModal(channel)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(channel.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {channels.length === 0 && (
                <tr>
                  <td colSpan={activeTab === 'source' ? 8 : 10} className="px-6 py-12 text-center text-gray-500">
                    No {activeTab} channels configured. Click "Add {activeTab === 'source' ? 'Source' : 'Target'} Channel" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {channelModal !== null && (
        <ChannelModal
          channel={channelModal}
          type={activeTab}
          accounts={accounts}
          onClose={() => setChannelModal(null)}
          onSubmit={handleChannelSubmit}
          loading={submitting}
        />
      )}
      {scrapeModal !== null && (
        <ScrapeModal
          channel={scrapeModal}
          accounts={accounts}
          onClose={() => setScrapeModal(null)}
          onSubmit={handleScrapeSubmit}
          loading={submitting}
        />
      )}
    </div>
  )
}

import { formatDistanceToNow } from 'date-fns'