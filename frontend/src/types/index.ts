export interface UserResponse {
  id: number
  email: string
  full_name: string | null
  is_active: boolean
  is_superuser: boolean
  created_at: string
  updated_at: string
  last_login: string | null
}

export interface Token {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface AccountResponse {
  id: number
  api_id: number
  api_hash: string
  phone: string
  proxy_id: number | null
  daily_add_limit: number
  status: AccountStatus
  adds_today: number
  last_add_reset: string
  flood_wait_until: string | null
  is_default: boolean
  created_at: string
  updated_at: string
  last_used_at: string | null
}

export type AccountStatus = 'active' | 'inactive' | 'banned' | 'flood_wait' | 'auth_required'

export interface ProxyResponse {
  id: number
  host: string
  port: number
  username: string | null
  password: string | null
  proxy_type: string
  is_active: boolean
  created_at: string
}

export interface SourceChannelResponse {
  id: number
  channel_id: number
  username: string | null
  title: string
  access_hash: number | null
  account_id: number
  last_scraped_at: string | null
  total_members: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TargetChannelResponse {
  id: number
  channel_id: number
  username: string | null
  title: string
  access_hash: number | null
  invite_link: string | null
  account_id: number
  max_per_day: number
  adds_today: number
  last_add_reset: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MemberResponse {
  id: number
  user_id: number
  access_hash: number | null
  username: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  is_bot: boolean
  is_verified: boolean
  is_premium: boolean
  status: string | null
  source_channel_id: number
  scraped_at: string
}

export interface AddJobResponse {
  id: number
  source_channel_id: number
  target_channel_id: number
  account_id: number
  status: JobStatus
  total_members: number
  processed_members: number
  successful_adds: number
  failed_adds: number
  flood_wait_count: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  filter_usernames_only: boolean
  filter_recent_activity: boolean
  filter_no_bots: boolean
  limit: number | null
  offset: number
  source_channel?: SourceChannelResponse
  target_channel?: TargetChannelResponse
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'

export interface AddJobProgress {
  job_id: number
  status: JobStatus
  total_members: number
  processed_members: number
  successful_adds: number
  failed_adds: number
  progress_percent: number
  current_member: string | null
}

export interface AddedMemberResponse {
  id: number
  job_id: number
  member_id: number
  status: MemberAddStatus
  error_message: string | null
  added_at: string
  member?: MemberResponse
}

export type MemberAddStatus = 
  | 'success'
  | 'failed'
  | 'flood_wait'
  | 'user_privacy'
  | 'user_already_participant'
  | 'channel_private'
  | 'peer_flood'
  | 'bot_method_invalid'
  | 'unknown'

export interface DashboardStats {
  total_accounts: number
  active_accounts: number
  total_source_channels: number
  total_target_channels: number
  total_members_scraped: number
  total_members_added: number
  running_jobs: number
  pending_jobs: number
}

export interface AccountStats {
  account_id: number
  phone: string
  status: AccountStatus
  adds_today: number
  daily_limit: number
  source_channels_count: number
  target_channels_count: number
  members_scraped: number
  members_added: number
}

export interface ScrapeRequest {
  source_channel_id: number
  account_id?: number
  limit?: number
  offset?: number
  filter_usernames_only?: boolean
  filter_recent_activity?: boolean
}

export interface ScrapeResponse {
  job_id: string
  status: string
  message: string
}

export interface AddJobCreate {
  source_channel_id: number
  target_channel_id: number
  account_id: number
  filter_usernames_only?: boolean
  filter_recent_activity?: boolean
  filter_no_bots?: boolean
  limit?: number
  offset?: number
}