import { useEffect, useState } from 'react'
import api from '../services/api'
import type { DashboardStats, AccountStats } from '../types'
import { 
  Users, Hash, Briefcase, TrendingUp, Activity, AlertCircle, 
  Loader2, RefreshCw, ExternalLink
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  trend, 
  trendColor 
}: { 
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
  trend?: string
  trendColor?: string
}) => (
  <div className="bg-white overflow-hidden shadow rounded-lg">
    <div className="p-5">
      <div className="flex items-center">
        <div className={`flex-shrink-0 p-3 rounded-md ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="text-lg font-medium text-gray-900">{value}</dd>
          </dl>
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center">
          <span className={`text-sm font-medium ${trendColor || 'text-green-600'}`}>
            {trend}
          </span>
        </div>
      )}
    </div>
  </div>
)

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [accountStats, setAccountStats] = useState<AccountStats[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      const [statsRes, accountsRes] = await Promise.all([
        api.get('/accounts/stats'),
        api.get('/accounts/account-stats'),
      ])
      setStats(statsRes.data)
      setAccountStats(accountsRes.data)
    } catch (error) {
      toast.error('Failed to load dashboard stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-12 w-12 text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of your Telegram member management</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Accounts"
          value={stats?.total_accounts || 0}
          icon={Users}
          color="bg-blue-500"
          trend={`${stats?.active_accounts || 0} active`}
          trendColor="text-blue-600"
        />
        <StatCard
          title="Source Channels"
          value={stats?.total_source_channels || 0}
          icon={Hash}
          color="bg-purple-500"
        />
        <StatCard
          title="Target Channels"
          value={stats?.total_target_channels || 0}
          icon={Hash}
          color="bg-green-500"
        />
        <StatCard
          title="Members Scraped"
          value={stats?.total_members_scraped || 0}
          icon={TrendingUp}
          color="bg-orange-500"
        </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Members Added"
          value={stats?.total_members_added || 0}
          icon={Activity}
          color="bg-teal-500"
        />
        <StatCard
          title="Running Jobs"
          value={stats?.running_jobs || 0}
          icon={Briefcase}
          color="bg-indigo-500"
          trend="Active"
          trendColor="text-indigo-600"
        />
        <StatCard
          title="Pending Jobs"
          value={stats?.pending_jobs || 0}
          icon={Briefcase}
          color="bg-yellow-500"
          trend="Queued"
          trendColor="text-yellow-600"
        />
        <StatCard
          title="Success Rate"
          value={
            stats && stats.total_members_added > 0
              ? `${Math.round((stats.total_members_added / (stats.total_members_scraped || 1)) * 100)}%`
              : '0%'
          }
          icon={TrendingUp}
          color="bg-pink-500"
        />
      </div>

      {/* Account Stats Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Account Statistics</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Today's Adds</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source Channels</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Channels</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scraped</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {accountStats.map((account) => (
                <tr key={account.account_id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-700 font-medium text-sm">
                          {account.phone.slice(-4)}
                        </span>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">+{account.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      account.status === 'active' ? 'bg-green-100 text-green-800' :
                      account.status === 'flood_wait' ? 'bg-yellow-100 text-yellow-800' :
                      account.status === 'banned' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {account.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {account.adds_today} / {account.daily_limit}
                    <div className="w-32 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          account.adds_today / account.daily_limit > 0.8 ? 'bg-red-500' :
                          account.adds_today / account.daily_limit > 0.5 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, (account.adds_today / account.daily_limit) * 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {account.source_channels_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {account.target_channels_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {account.members_scraped}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {account.members_added}
                  </td>
                </tr>
              ))}
              {accountStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No accounts configured yet. <a href="/accounts" className="text-blue-600 hover:underline">Add your first account</a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}