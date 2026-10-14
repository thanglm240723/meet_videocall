using BE.Dtos;
using BE.Service.goi_video;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace BE.Realtime
{
    
    [Authorize]
    public class CuocGoiHub(IGoiVideoService goiVideo, OnlineUsers online) : Hub
    {
        private long UserId => long.Parse(Context.User!.FindFirst("sub")!.Value);

        public override async Task OnConnectedAsync()
        {
            online.Add(UserId);
            await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(UserId));
            await base.OnConnectedAsync();
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            online.Remove(UserId);
            return base.OnDisconnectedAsync(exception);
        }

        public async Task<JoinInfoDto> StartCall(List<string> emails)
        {
            var call = await Run(() => goiVideo.StartCallAsync(UserId, emails));

            var callees = call.Members.Where(m => !m.IsOwner).Select(m => UserGroup(m.UserId)).ToList();
            await Clients.Groups(callees).SendAsync("IncomingCall", call);

            return new JoinInfoDto(call);
        }

        public async Task<JoinInfoDto> Accept(long callId)
        {
            var call = await Run(() => goiVideo.AcceptAsync(callId, UserId));
            await SendCallAsync(Clients, call);
            return new JoinInfoDto(call);
        }

        public async Task Decline(long callId)
        {
            var call = await Run(() => goiVideo.DeclineAsync(callId, UserId));
            await SendCallAsync(Clients, call);
        }

        public async Task Leave(long callId)
        {
            var call = await Run(() => goiVideo.LeaveAsync(callId, UserId));
            await SendCallAsync(Clients, call);
        }

        public async Task EndForAll(long callId)
        {
            var call = await Run(() => goiVideo.EndForAllAsync(callId, UserId));
            await SendCallAsync(Clients, call);
        }

        // goi nhom: co the phai cho nguoi goi duyet (member.waitingApproval = true)
        public async Task<JoinInfoDto> Rejoin(long callId)
        {
            var call = await Run(() => goiVideo.RejoinAsync(callId, UserId));
            await SendCallAsync(Clients, call);
            return new JoinInfoDto(call);
        }

        public async Task ApproveRejoin(long callId, long userId, bool accept)
        {
            var call = await Run(() => goiVideo.ApproveRejoinAsync(callId, UserId, userId, accept));
            await SendCallAsync(Clients, call);

            if (!accept)
                await Clients.Group(UserGroup(userId)).SendAsync("RejoinDenied", callId);
        }

        public Task<List<CallViewDto>> GetMyCalls() => goiVideo.GetMyCallsAsync(UserId);

        public static string UserGroup(long userId) => $"user:{userId}";

        // gui trang thai moi cho tat ca thanh vien (dung ca o RingTimeoutWorker)
        public static Task SendCallAsync(IHubClients<IClientProxy> clients, CallViewDto call)
        {
            var groups = call.Members.Select(m => UserGroup(m.UserId)).ToList();
            var eventName = call.Status is "ended" or "cancelled" ? "CallEnded" : "CallUpdated";

            return clients.Groups(groups).SendAsync(eventName, call);
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
