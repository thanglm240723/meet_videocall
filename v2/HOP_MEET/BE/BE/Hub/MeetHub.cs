using System.Text.Json;
using BE.Dtos;
using BE.Service.goi_video;
using BE.Service.phong_hop;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace BE.Realtime
{
   
    [Authorize]
    public class MeetHub(RoomRegistry room, IPhongHopService phongHop, IGoiVideoService goiVideo) : Hub
    {
        private long UserId => long.Parse(Context.User!.FindFirst("sub")!.Value);
        private string UserName => Context.User!.FindFirst("name")?.Value ?? "Khách";

      
        public record JoinResult(
            string Status,
            string? MyId,
            long MyUserId,
            bool IsOwner,
            bool MutedByOwner,
            List<Peer> Peers,
            List<ChatMessageDto> Messages,
            RoomLocks Locks);

        public async Task<JoinResult> JoinMeeting(string joinCode, bool mic, bool cam)
        {
            await LeaveCurrentRoom();

            var check = await Run(() => phongHop.CheckJoinAsync(joinCode, UserId));
            var roomId = $"meet:{check.Meeting.Id}";

            if (check.Member is null)
            {
                room.AddWaiting(new WaitingPerson(Context.ConnectionId, roomId, check.Meeting.Id, UserId, UserName));
                await NotifyWaitingList(roomId);
                return new JoinResult("waiting", null, UserId, false, false, [], [], RoomLocks.None);
            }

            room.RemoveWaiting(Context.ConnectionId);

            var member = check.Member;
            var locks = check.IsOwner ? RoomLocks.None : room.GetLocks(roomId);
            var me = new Peer
            {
                ConnectionId = Context.ConnectionId,
                RoomId = roomId,
                MeetingId = check.Meeting.Id,
                MemberId = member.Id,
                UserId = UserId,
                DisplayName = member.DisplayName,
                IsOwner = check.IsOwner,
                Mic = mic && !member.IsMutedByOwner && !locks.Mic,
                Cam = cam && !locks.Cam,
            };

            await phongHop.OpenJoinLogAsync(member.Id);

            var others = room.Join(me);
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
            await Clients.OthersInGroup(roomId).SendAsync("PeerJoined", me);

            if (me.IsOwner)
                await Clients.Caller.SendAsync("WaitingUpdated", WaitingList(roomId));

            var messages = await phongHop.GetMessagesAsync(check.Meeting.Id);
            return new JoinResult("joined", Context.ConnectionId, UserId, me.IsOwner, member.IsMutedByOwner, others, messages, room.GetLocks(roomId));
        }

        public async Task<JoinResult> JoinCall(long callId, bool mic, bool cam)
        {
            await LeaveCurrentRoom();

            var info = await Run(() => goiVideo.CheckInRoomAsync(callId, UserId));
            var roomId = $"call:{callId}";

            var me = new Peer
            {
                ConnectionId = Context.ConnectionId,
                RoomId = roomId,
                CallId = callId,
                UserId = UserId,
                DisplayName = info.DisplayName,
                IsOwner = info.IsOwner,
                Mic = mic,
                Cam = cam,
            };

            var others = room.Join(me);
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
            await Clients.OthersInGroup(roomId).SendAsync("PeerJoined", me);

            return new JoinResult("joined", Context.ConnectionId, UserId, me.IsOwner, false, others, [], RoomLocks.None);
        }

       
        public async Task ApproveJoin(long userId, bool accept)
        {
            var me = RequireMeetingOwner();
            await phongHop.ApproveJoinAsync(me.MeetingId!.Value, userId, accept);

            foreach (var w in room.GetWaiting(me.RoomId).Where(w => w.UserId == userId))
            {
                room.RemoveWaiting(w.ConnectionId);
                await Clients.Client(w.ConnectionId).SendAsync(accept ? "JoinApproved" : "JoinDenied");
            }

            await NotifyWaitingList(me.RoomId);
        }

        public async Task ApproveAll(bool accept)
        {
            var me = RequireMeetingOwner();
            var userIds = room.GetWaiting(me.RoomId).Select(w => w.UserId).Distinct().ToList();

            foreach (var userId in userIds)
                await ApproveJoin(userId, accept);
        }

        public Task Signal(string to, JsonElement data)
        {
            if (!room.SameRoom(Context.ConnectionId, to)) throw new HubException("Không cùng phòng.");
            return Clients.Client(to).SendAsync("Signal", Context.ConnectionId, data);
        }

        public async Task UpdateMedia(bool mic, bool cam, string? screenStreamId)
        {
            var me = room.Get(Context.ConnectionId) ?? throw new HubException("Chưa vào phòng.");

            if (!me.IsOwner)
            {
                var locks = room.GetLocks(me.RoomId);
                if (locks.Mic && mic && !me.Mic) throw new HubException("Chủ phòng đang khoá micro.");
                if (locks.Cam && cam && !me.Cam) throw new HubException("Chủ phòng đang khoá camera.");
                if (locks.Screen && screenStreamId is not null && me.ScreenStreamId is null)
                    throw new HubException("Chủ phòng đang khoá chia sẻ màn hình.");

                mic &= !locks.Mic;
                cam &= !locks.Cam;
                if (locks.Screen) screenStreamId = null;
            }

           
            if (mic && !me.Mic && me.MeetingId is long meetingId)
                await phongHop.SetMutedByOwnerAsync(meetingId, me.UserId, false);

            me.Mic = mic;
            me.Cam = cam;
            me.ScreenStreamId = screenStreamId;
            await Clients.OthersInGroup(me.RoomId).SendAsync("PeerUpdated", me);
        }

        public async Task MutePeer(string target)
        {
            var me = room.Get(Context.ConnectionId);
            var t = room.Get(target);
            if (me is not { IsOwner: true } || t is null || t.RoomId != me.RoomId)
                throw new HubException("Không có quyền.");

            await MuteOne(t);
        }

        public async Task MuteAll()
        {
            var me = room.Get(Context.ConnectionId);
            if (me is not { IsOwner: true }) throw new HubException("Không có quyền.");

            foreach (var p in room.GetPeers(me.RoomId).Where(p => p.ConnectionId != me.ConnectionId && p.Mic))
                await MuteOne(p);
        }

       
        public async Task KickPeer(string target)
        {
            var me = RequireMeetingOwner();
            var t = room.Get(target);
            if (t is null || t.RoomId != me.RoomId || t.ConnectionId == me.ConnectionId)
                throw new HubException("Không tìm thấy người này trong phòng.");

            await Clients.Client(t.ConnectionId).SendAsync("Kicked");
            await RemoveFromRoom(t.ConnectionId);
        }


        public async Task EndMeeting()
        {
            var me = RequireMeetingOwner();
            var roomId = me.RoomId;

            await phongHop.EndMeetingAsync(me.MeetingId!.Value);

            await Clients.Group(roomId).SendAsync("MeetingEnded");
            foreach (var w in room.GetWaiting(roomId))
            {
                room.RemoveWaiting(w.ConnectionId);
                await Clients.Client(w.ConnectionId).SendAsync("MeetingEnded");
            }

            foreach (var p in room.GetPeers(roomId))
                await RemoveFromRoom(p.ConnectionId, notify: false);

            room.ClearLocks(roomId);
        }

        public async Task SetLocks(bool mic, bool cam, bool screen)
        {
            var me = RequireMeetingOwner();
            var locks = new RoomLocks(mic, cam, screen);
            room.SetLocks(me.RoomId, locks);

            await Clients.Group(me.RoomId).SendAsync("LocksUpdated", locks);

            foreach (var p in room.GetPeers(me.RoomId).Where(p => !p.IsOwner))
            {
                var changed = (mic && p.Mic) || (cam && p.Cam) || (screen && p.ScreenStreamId is not null);
                if (!changed) continue;

                if (mic) p.Mic = false;
                if (cam) p.Cam = false;
                if (screen) p.ScreenStreamId = null;
                await Clients.Group(me.RoomId).SendAsync("PeerUpdated", p);
            }
        }

        public async Task RaiseHand(bool raised)
        {
            var me = room.Get(Context.ConnectionId) ?? throw new HubException("Chưa vào phòng.");
            me.HandRaisedAt = raised ? (me.HandRaisedAt ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) : null;
            await Clients.Group(me.RoomId).SendAsync("PeerUpdated", me);
        }

        public async Task LowerHand(string target)
        {
            var me = RequireMeetingOwner();
            var t = room.Get(target);
            if (t is null || t.RoomId != me.RoomId) throw new HubException("Không tìm thấy người này trong phòng.");

            t.HandRaisedAt = null;
            await Clients.Group(me.RoomId).SendAsync("PeerUpdated", t);
        }

        public async Task SendChat(string text)
        {
            var me = room.Get(Context.ConnectionId) ?? throw new HubException("Chưa vào phòng.");
            if (me.MeetingId is null || me.MemberId is null) throw new HubException("Cuộc gọi này không có trò chuyện.");

            var message = await Run(() => phongHop.SaveMessageAsync(me.MeetingId.Value, me.MemberId.Value, text));
            await Clients.Group(me.RoomId).SendAsync("Chat", message);
        }

        public Task LeaveRoom() => LeaveCurrentRoom();

        public override async Task OnDisconnectedAsync(Exception? ex)
        {
            var waiting = room.RemoveWaiting(Context.ConnectionId);
            if (waiting is not null)
            {
                await phongHop.CancelJoinRequestAsync(waiting.MeetingId, waiting.UserId);
                await NotifyWaitingList(waiting.RoomId);
            }

            await LeaveCurrentRoom();
            await base.OnDisconnectedAsync(ex);
        }

        private async Task MuteOne(Peer target)
        {
            if (target.MeetingId is long meetingId)
                await phongHop.SetMutedByOwnerAsync(meetingId, target.UserId, true);

            target.Mic = false;
            await Clients.Client(target.ConnectionId).SendAsync("ForceMute");
            await Clients.Group(target.RoomId).SendAsync("PeerUpdated", target);
        }

        private Task LeaveCurrentRoom() => RemoveFromRoom(Context.ConnectionId);

        private async Task RemoveFromRoom(string connectionId, bool notify = true)
        {
            var p = room.Leave(connectionId);
            if (p is null) return;

            await Groups.RemoveFromGroupAsync(connectionId, p.RoomId);
            if (notify) await Clients.Group(p.RoomId).SendAsync("PeerLeft", p.ConnectionId);

            if (p.MemberId is long memberId)
                await phongHop.CloseJoinLogAsync(memberId);

        
            if (p.MeetingId is long meetingId && room.GetPeers(p.RoomId).Count == 0)
            {
                room.ClearLocks(p.RoomId);
                await phongHop.DeleteMessagesAsync(meetingId);
            }
        }

        private Peer RequireMeetingOwner()
        {
            var me = room.Get(Context.ConnectionId);
            if (me is not { IsOwner: true } || me.MeetingId is null)
                throw new HubException("Chỉ chủ phòng mới làm được việc này.");
            return me;
        }

        private List<WaitingPersonDto> WaitingList(string roomId) =>
            room.GetWaiting(roomId)
                .GroupBy(w => w.UserId)
                .Select(g => new WaitingPersonDto(g.Key, g.First().Name))
                .ToList();

        private Task NotifyWaitingList(string roomId)
        {
            var owners = room.GetPeers(roomId).Where(p => p.IsOwner).Select(p => p.ConnectionId).ToList();
            if (owners.Count == 0) return Task.CompletedTask;

            return Clients.Clients(owners).SendAsync("WaitingUpdated", WaitingList(roomId));
        }

       
        private static async Task<T> Run<T>(Func<Task<T>> action)
        {
            try
            {
                return await action();
            }
            catch (InvalidOperationException ex)
            {
                throw new HubException(ex.Message);
            }
        }
    }
}
