import asyncio
import logging
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager

from telethon import TelegramClient, errors
from telethon.sessions import StringSession
from telethon.tl.types import (
    Channel, User, Chat, PeerChannel, PeerUser, PeerChat,
    InputPeerChannel, InputPeerUser, InputPeerChat
)
from telethon.tl.functions.channels import (
    GetParticipantsRequest, InviteToChannelRequest,
    GetFullChannelRequest, JoinChannelRequest, LeaveChannelRequest
)
from telethon.tl.functions.messages import (
    GetDialogsRequest, ImportChatInviteRequest, CheckChatInviteRequest
)
from telethon.tl.functions.auth import (
    SendCodeRequest, SignInRequest, SignUpRequest
)
from telethon.tl.functions.account import UpdateStatusRequest

from app.core.config import settings
from app.core.security import encryption_service
from app.models.models import Account, Proxy, AccountStatus

logger = logging.getLogger(__name__)


class TelegramClientManager:
    """Manages multiple Telegram client instances with session persistence"""
    
    def __init__(self):
        self._clients: Dict[int, TelegramClient] = {}
        self._locks: Dict[int, asyncio.Lock] = {}
    
    def _get_proxy_config(self, proxy: Optional[Proxy]) -> Optional[Dict[str, Any]]:
        if not proxy or not proxy.is_active:
            return None
        
        proxy_dict = {
            "proxy_type": proxy.proxy_type,
            "addr": proxy.host,
            "port": proxy.port,
        }
        if proxy.username:
            proxy_dict["username"] = proxy.username
        if proxy.password:
            proxy_dict["password"] = proxy.password
        return proxy_dict
    
    async def get_client(self, account: Account) -> TelegramClient:
        """Get or create a Telegram client for an account"""
        if account.id in self._clients:
            client = self._clients[account.id]
            if client.is_connected():
                return client
            else:
                await client.disconnect()
        
        # Create new client
        session_string = encryption_service.decrypt(account.session_string) if account.session_string else None
        session = StringSession(session_string) if session_string else StringSession()
        
        proxy_config = self._get_proxy_config(account.proxy)
        
        client = TelegramClient(
            session,
            account.api_id,
            account.api_hash,
            proxy=proxy_config,
            connection_retries=5,
            retry_delay=1,
            timeout=30,
        )
        
        self._clients[account.id] = client
        self._locks[account.id] = asyncio.Lock()
        
        await client.connect()
        
        # Save session string if new
        if not account.session_string:
            account.session_string = encryption_service.encrypt(client.session.save())
        
        return client
    
    async def disconnect_client(self, account_id: int):
        """Disconnect and remove a client"""
        if account_id in self._clients:
            client = self._clients[account_id]
            if client.is_connected():
                await client.disconnect()
            del self._clients[account_id]
            if account_id in self._locks:
                del self._locks[account_id]
    
    async def disconnect_all(self):
        """Disconnect all clients"""
        for account_id in list(self._clients.keys()):
            await self.disconnect_client(account_id)
    
    @asynccontextmanager
    async def client_context(self, account: Account):
        """Context manager for client with lock"""
        lock = self._locks.setdefault(account.id, asyncio.Lock())
        async with lock:
            client = await self.get_client(account)
            try:
                yield client
            except errors.FloodWaitError as e:
                account.status = AccountStatus.FLOOD_WAIT
                account.flood_wait_until = e.seconds
                raise
            except errors.AuthKeyUnregisteredError:
                account.status = AccountStatus.AUTH_REQUIRED
                raise
            except Exception as e:
                logger.error(f"Client error for account {account.id}: {e}")
                raise
    
    async def send_code(self, account: Account) -> str:
        """Send authentication code"""
        async with self.client_context(account) as client:
            result = await client(SendCodeRequest(
                phone_number=account.phone,
                api_id=account.api_id,
                api_hash=account.api_hash,
                settings=client._default_send_code_settings
            ))
            return result.phone_code_hash
    
    async def sign_in(self, account: Account, code: str, phone_code_hash: str) -> bool:
        """Sign in with code"""
        async with self.client_context(account) as client:
            try:
                await client(SignInRequest(
                    phone_number=account.phone,
                    phone_code_hash=phone_code_hash,
                    phone_code=code
                ))
                account.status = AccountStatus.ACTIVE
                account.session_string = encryption_service.encrypt(client.session.save())
                return True
            except errors.SessionPasswordNeededError:
                # 2FA required
                raise
    
    async def sign_in_with_password(self, account: Account, password: str) -> bool:
        """Sign in with 2FA password"""
        async with self.client_context(account) as client:
            await client.sign_in(password=password)
            account.status = AccountStatus.ACTIVE
            account.session_string = encryption_service.encrypt(client.session.save())
            return True
    
    async def get_entity(self, account: Account, entity: str) -> Any:
        """Get entity by username, ID, or invite link"""
        async with self.client_context(account) as client:
            return await client.get_entity(entity)
    
    async def get_dialogs(self, account: Account, limit: int = 100) -> List[Any]:
        """Get user's dialogs (chats, channels)"""
        async with self.client_context(account) as client:
            return await client.get_dialogs(limit=limit)
    
    async def join_channel(self, account: Account, entity: str) -> bool:
        """Join a channel/group"""
        async with self.client_context(account) as client:
            try:
                await client(JoinChannelRequest(entity))
                return True
            except errors.UserAlreadyParticipantError:
                return True
            except Exception as e:
                logger.error(f"Failed to join channel: {e}")
                return False
    
    async def leave_channel(self, account: Account, entity: str) -> bool:
        """Leave a channel/group"""
        async with self.client_context(account) as client:
            try:
                await client(LeaveChannelRequest(entity))
                return True
            except Exception as e:
                logger.error(f"Failed to leave channel: {e}")
                return False
    
    async def get_participants(
        self, 
        account: Account, 
        channel: Any,
        limit: Optional[int] = None,
        offset: int = 0,
        filter_usernames_only: bool = False,
        filter_recent: bool = False
    ) -> List[User]:
        """Get channel participants with filtering"""
        from telethon.tl.types import ChannelParticipantsRecent, ChannelParticipantsSearch
        
        participants = []
        
        async with self.client_context(account) as client:
            # Determine filter
            if filter_recent:
                filter_obj = ChannelParticipantsRecent()
            elif filter_usernames_only:
                filter_obj = ChannelParticipantsSearch("a")  # Will filter manually
            else:
                filter_obj = ChannelParticipantsSearch("")
            
            async for user in client.iter_participants(
                channel,
                filter=filter_obj,
                limit=limit,
                offset=offset
            ):
                if not isinstance(user, User):
                    continue
                
                # Apply filters
                if filter_usernames_only and not user.username:
                    continue
                
                if user.bot:
                    continue  # Skip bots by default
                
                participants.append(user)
                
                if limit and len(participants) >= limit:
                    break
            
            return participants
    
    async def invite_to_channel(
        self, 
        account: Account, 
        channel: Any, 
        users: List[Any]
    ) -> Dict[int, MemberAddStatus]:
        """Invite users to channel"""
        results = {}
        
        async with self.client_context(account) as client:
            for user in users:
                try:
                    if isinstance(user, User):
                        user_id = user.id
                        access_hash = user.access_hash
                    else:
                        # Assume it's an ID
                        user_id = user
                        access_hash = 0
                    
                    await client(InviteToChannelRequest(
                        channel=channel,
                        users=[InputPeerUser(user_id=user_id, access_hash=access_hash)]
                    ))
                    results[user_id] = MemberAddStatus.SUCCESS
                    account.adds_today += 1
                    
                except errors.FloodWaitError as e:
                    results[user_id] = MemberAddStatus.FLOOD_WAIT
                    account.flood_wait_until = e.seconds
                    raise
                except errors.UserPrivacyRestrictedError:
                    results[user_id] = MemberAddStatus.USER_PRIVACY
                except errors.UserAlreadyParticipantError:
                    results[user_id] = MemberAddStatus.USER_ALREADY_PARTICIPANT
                except errors.ChannelPrivateError:
                    results[user_id] = MemberAddStatus.CHANNEL_PRIVATE
                except errors.PeerFloodError:
                    results[user_id] = MemberAddStatus.PEER_FLOOD
                    raise
                except errors.BotMethodInvalidError:
                    results[user_id] = MemberAddStatus.BOT_METHOD_INVALID
                except Exception as e:
                    logger.error(f"Failed to add user {user_id}: {e}")
                    results[user_id] = MemberAddStatus.UNKNOWN
        
        return results
    
    async def get_invite_link(self, account: Account, channel: Any) -> Optional[str]:
        """Get or create invite link for channel"""
        async with self.client_context(account) as client:
            try:
                full_channel = await client(GetFullChannelRequest(channel=channel))
                if full_channel.full_chat.exported_invite:
                    return full_channel.full_chat.exported_invite.link
                # Create new invite link
                from telethon.tl.functions.messages import ExportChatInviteRequest
                result = await client(ExportChatInviteRequest(
                    peer=channel,
                    legacy_revoke_permanent=True
                ))
                return result.link
            except Exception as e:
                logger.error(f"Failed to get invite link: {e}")
                return None
    
    async def check_invite_link(self, account: Account, invite_hash: str) -> Any:
        """Check an invite link without joining"""
        async with self.client_context(account) as client:
            return await client(CheckChatInviteRequest(hash=invite_hash))
    
    async def import_chat_invite(self, account: Account, invite_hash: str) -> Any:
        """Join via invite link"""
        async with self.client_context(account) as client:
            return await client(ImportChatInviteRequest(hash=invite_hash))
    
    async def set_online(self, account: Account):
        """Set account online status"""
        async with self.client_context(account) as client:
            await client(UpdateStatusRequest(offline=False))
    
    async def set_offline(self, account: Account):
        """Set account offline status"""
        async with self.client_context(account) as client:
            await client(UpdateStatusRequest(offline=True))


# Global instance
telegram_manager = TelegramClientManager()