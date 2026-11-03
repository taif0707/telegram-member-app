import { useEffect, useState } from 'react'
import api from '../services/api'
import type { AddJobResponse, AddJobCreate, AddJobProgress, AddedMemberResponse, SourceChannelResponse, TargetChannelResponse, AccountResponse } from '../types'
import { 
  Plus, Edit, Trash2, Play, Pause, StopCircle, Loader2, 
  Eye, Download, RefreshCw, AlertCircle, CheckCircle, XCircle,
  Clock, TrendingUp, Users
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

const JobModal = ({ 
  job, 
  sourceChannels,
  targetChannels,
  accounts,
  onClose, 
  onSubmit, 
  loading 
}: { 
  job: AddJobResponse | null
  sourceChannels: SourceChannelResponse[]
  targetChannels: TargetChannelResponse[]
  accounts: AccountResponse[]
  onClose: () => void
  onSubmit: (data: AddJobCreate) => Promise<void>
  loading: boolean
}) => {
  const [formData, setFormData] = useState({
    source_channel_id: '',
    target_channel_id: '',
    account_id: '',
    filter_usernames_only: false,
    filter_recent_activity: false,
    filter_no_bots: true,
    limit: '',
    offset: 0,
  })

  useEffect(() => {
    if (job) {
      setFormData({
        source_channel_id: String(job.source_channel_id),
        target_channel_id: String(job.target_channel_id),
        account_id: String(job.account_id),
        filter_usernames_only: job.filter_usernames_only,
        filter_recent_activity: job.filter_recent_activity,
        filter_no_bots: job.filter_no_bots,
        limit: String(job.limit || ''),
        offset: job.offset,
      })
    }
  }, [job])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      source_channel_id: Number(formData.source_channel_id),
      target_channel_id: Number(formData.target_channel_id),
      account_id: Number(formData.account_id),
      filter_usernames_only: formData.filter_usernames_only,
      filter_recent_activity: formData.filter_recent_activity,
      filter_no_bots: formData.filter_no_bots,
      limit: formData.limit ? Number(formData.limit) : undefined,
      offset: formData.offset,
    }
    await onSubmit(data)
  }

  // Filter target channels based on selected source channel's account
  const filteredTargets = targetChannels.filter(t => 
    !formData.source_channel_id || 
    t.account_id === sourceChannels.find(s => s.id === Number(formData.source_channel_id))?.account_id
  )

  // Filter accounts based on selected source channel
  const filteredAccounts = accounts.filter(a => 
    !formData.source_channel_id || 
    a.id === sourceChannels.find(s => s.id === Number(formData.source_channel_id))?.account_id
  )

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
            <h3 className="text-lg font-semibold">{job ? 'Edit Job' : 'Create Add Job'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source Channel</label>
              <select
                value={formData.source_channel_id}
                onChange={(e) => {
                  setFormData({...formData, source_channel_id: e.target.value, target_channel_id: '', account_id: ''})
                }}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select source channel</option>
                {sourceChannels.map((c) => (
                  <option key={c.id} value={c.id}>{c.title} (@{c.username || c.channel_id})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Channel</label>
              <select
                value={formData.target_channel_id}
                onChange={(e) => setFormData({...formData, target_channel_id: e.target.value})}
                required
                disabled={filteredTargets.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select target channel</option>
                {filteredTargets.map((c) => (
                  <option key={c.id} value={c.id}>{c.title} (@{c.username || c.channel_id})</option>
                ))}
              </select>
              {filteredTargets.length === 0 && formData.source_channel_id && (
                <p className="mt-1 text-sm text-yellow-600">No target channels available for this source channel's account</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
              <select
                value={formData.account_id}
                onChange={(e) => setFormData({...formData, account_id: e.target.value})}
                required
                disabled={filteredAccounts.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select account</option>
                {filteredAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.phone} ({a.status})</option>
                ))}
              </select>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Filters</h4>
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
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.filter_no_bots}
                    onChange={(e) => setFormData({...formData, filter_no_bots: e.target.checked})}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Exclude bots</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Limit (Optional)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.limit}
                  onChange={(e) => setFormData({...formData, limit: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="No limit"
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
            </div>
            <div className="flex space-x-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white py-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : (job ? 'Save' : 'Create Job')}
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

const ProgressModal = ({ 
  job, 
  progress,
  addedMembers,
  onClose 
}: { 
  job: AddJobResponse
  progress: AddJobProgress | null
  addedMembers: AddedMemberResponse[]
  onClose: () => void
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  const fetchProgress = async () => {
    setRefreshing(true)
    try {
      const [progRes, membersRes] = await Promise.all([
        api.get(`/jobs/${job.id}/progress`),
        api.get(`/jobs/${job.id}/added-members`),
      ])
      // Update parent state via callback or ref
      // For now, we'll just show current data
    } catch (error) {
      console.error('Failed to refresh progress')
    } finally {
      setRefreshing(false)
    }
  }

  const filteredMembers = addedMembers.filter(m => 
    statusFilter === 'all' || m.status === statusFilter
  )

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />
      case 'flood_wait': return <Clock className="w-4 h-4 text-yellow-500" />
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'flood_wait': return 'bg-yellow-100 text-yellow-800'
      case 'user_privacy': return 'bg-orange-100 text-orange-800'
      case 'user_already_participant': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
            <h3 className="text-lg font-semibold">Job Progress: {job.source_channel?.title} → {job.target_channel?.title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Header */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-500">Total Members</p>
                <p className="text-2xl font-bold text-gray-900">{job.total_members}</p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-500">Processed</p>
                <p className="text-2xl font-bold text-gray-900">{progress?.processed_members || job.processed_members}</p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-500">Successful</p>
                <p className="text-2xl font-bold text-green-600">{progress?.successful_adds || job.successful_adds}</p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-500">Failed</p>
                <p className="text-2xl font-bold text-red-600">{progress?.failed_adds || job.failed_adds}</p>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${progress?.progress_percent || 0}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-500">
              <span>{progress?.progress_percent?.toFixed(1) || 0}% Complete</span>
              <span>Status: {progress?.status || job.status}</span>
            </div>
            
            {progress?.current_member && (
              <p className="mt-2 text-sm text-gray-600">
                Current: <span className="font-medium">{progress.current_member}</span>
              </p>
            )}
          </div>

          {/* Filters */}
          <div className="px-6 py-4 border-b border-gray-200 sticky top-14 bg-white z-10">
            <div className="flex items-center space-x-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="flood_wait">Flood Wait</option>
                <option value="user_privacy">User Privacy</option>
                <option value="user_already_participant">Already Participant</option>
              </select>
              <button
                onClick={fetchProgress}
                disabled={refreshing}
                className="px-3 py-2 text-gray-400 hover:text-gray-600"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Members List */}
          <div className="flex-1 overflow-y-auto p-6">
            {filteredMembers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No members added yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(member.status)}
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.member?.first_name || ''} {member.member?.last_name || ''}
                          {member.member?.username && <span className="text-gray-500 ml-2">@{member.member.username}</span>}
                        </p>
                        <p className="text-sm text-gray-500">ID: {member.member?.user_id}</p>
                      </div>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(member.status)}`}>
                      {member.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'

export default function Jobs() {
  const [jobs, setJobs] = useState<AddJobResponse[]>([])
  const [sourceChannels, setSourceChannels] = useState<SourceChannelResponse[]>([])
  const [targetChannels, setTargetChannels] = useState<TargetChannelResponse[]>([])
  const [accounts, setAccounts] = useState<AccountResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [jobModal, setJobModal] = useState<AddJobResponse | null>(null)
  const [progressModal, setProgressModal] = useState<AddJobResponse | null>(null)
  const [progressData, setProgressData] = useState<AddJobProgress | null>(null)
  const [addedMembers, setAddedMembers] = useState<AddedMemberResponse[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const fetchData = async () => {
    try {
      const [jobsRes, sourcesRes, targetsRes, accountsRes] = await Promise.all([
        api.get('/jobs', { params: { status: statusFilter !== 'all' ? statusFilter : undefined } }),
        api.get('/channels/source'),
        api.get('/channels/target'),
        api.get('/accounts'),
      ])
      setJobs(jobsRes.data)
      setSourceChannels(sourcesRes.data)
      setTargetChannels(targetsRes.data)
      setAccounts(accountsRes.data)
    } catch (error) {
      toast.error('Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (data: AddJobCreate) => {
    setSubmitting(true)
    try {
      if (jobModal) {
        await api.put(`/jobs/${jobModal.id}`, data)
        toast.success('Job updated')
      } else {
        await api.post('/jobs', data)
        toast.success('Job created')
      }
      setJobModal(null)
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save job')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStart = async (job: AddJobResponse) => {
    try {
      await api.post(`/jobs/${job.id}/start`)
      toast.success('Job started')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to start job')
    }
  }

  const handlePause = async (job: AddJobResponse) => {
    try {
      await api.post(`/jobs/${job.id}/pause`)
      toast.success('Job paused')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to pause job')
    }
  }

  const handleCancel = async (job: AddJobResponse) => {
    if (!confirm('Cancel this job?')) return
    try {
      await api.post(`/jobs/${job.id}/cancel`)
      toast.success('Job cancelled')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to cancel job')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this job?')) return
    try {
      await api.delete(`/jobs/${id}`)
      toast.success('Job deleted')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete job')
    }
  }

  const handleViewProgress = async (job: AddJobResponse) => {
    try {
      const [progRes, membersRes] = await Promise.all([
        api.get(`/jobs/${job.id}/progress`),
        api.get(`/jobs/${job.id}/added-members`),
      ])
      setProgressData(progRes.data)
      setAddedMembers(membersRes.data)
      setProgressModal(job)
    } catch (error) {
      toast.error('Failed to load progress')
    }
  }

  useEffect(() => {
    fetchData()
  }, [statusFilter])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'paused': return 'bg-orange-100 text-orange-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 className="w-4 h-4 animate-spin" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'failed': return <XCircle className="w-4 h-4" />
      case 'pending': return <Clock className="w-4 h-4" />
      case 'paused': return <Pause className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-gray-500">Manage member addition jobs</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={() => setJobModal(null)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Job</span>
          </button>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source → Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success / Failed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900 truncate max-w-xs">
                        {job.source_channel?.title || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-500 truncate max-w-xs">
                        → {job.target_channel?.title || 'Unknown'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {accounts.find(a => a.id === job.account_id)?.phone || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(job.status)}`}>
                      {getStatusIcon(job.status)}
                      <span className="ml-1">{job.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          job.status === 'completed' ? 'bg-green-500' :
                          job.status === 'failed' ? 'bg-red-500' :
                          job.status === 'running' ? 'bg-blue-500' :
                          'bg-yellow-500'
                        }`}
                        style={{ width: `${job.total_members > 0 ? (job.processed_members / job.total_members) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {job.processed_members} / {job.total_members}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="text-green-600">{job.successful_adds}</span> / 
                    <span className="text-red-600">{job.failed_adds}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {job.started_at ? formatDistanceToNow(new Date(job.started_at), { addSuffix: true }) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {job.completed_at ? formatDistanceToNow(new Date(job.completed_at), { addSuffix: true }) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleViewProgress(job)}
                        className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        <Eye className="w-3 h-3 inline mr-1" />
                        Progress
                      </button>
                      {job.status === 'pending' || job.status === 'failed' ? (
                        <button
                          onClick={() => handleStart(job)}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          <Play className="w-3 h-3 inline mr-1" />
                          Start
                        </button>
                      ) : job.status === 'running' ? (
                        <button
                          onClick={() => handlePause(job)}
                          className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
                        >
                          <Pause className="w-3 h-3 inline mr-1" />
                          Pause
                        </button>
                      ) : null}
                      {['pending', 'running', 'paused'].includes(job.status) && (
                        <button
                          onClick={() => handleCancel(job)}
                          className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          <StopCircle className="w-3 h-3 inline mr-1" />
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => setJobModal(job)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {job.status !== 'running' && (
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No jobs found. Click "Create Job" to start adding members.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {jobModal !== null && (
        <JobModal
          job={jobModal}
          sourceChannels={sourceChannels}
          targetChannels={targetChannels}
          accounts={accounts}
          onClose={() => setJobModal(null)}
          onSubmit={handleSubmit}
          loading={submitting}
        />
      )}
      {progressModal !== null && (
        <ProgressModal
          job={progressModal}
          progress={progressData}
          addedMembers={addedMembers}
          onClose={() => setProgressModal(null)}
        />
      )}
    </div>
  )
}