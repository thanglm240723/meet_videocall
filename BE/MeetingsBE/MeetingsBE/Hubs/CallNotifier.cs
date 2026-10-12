using System.Globalization;
using MeetingsBE.Dtos;
using Microsoft.AspNetCore.SignalR;

namespace MeetingsBE.Hubs;

public interface ICallNotifier
{
    Task IncomingCallAsync(IEnumerable<long> userIds, CallView call);

    Task CallUpdatedAsync(IEnumerable<long> userIds, CallView call);

    Task CallEndedAsync(IEnumerable<long> userIds, CallView call);
}

public sealed class CallNotifier : ICallNotifier
{
    private readonly IHubContext<CallHub> _hub;

    public CallNotifier(IHubContext<CallHub> hub)
    {
        _hub = hub;
    }

    public Task IncomingCallAsync(IEnumerable<long> userIds, CallView call) => _hub.Clients.Users(Ids(userIds)).SendAsync("IncomingCall", call);

    public Task CallUpdatedAsync(IEnumerable<long> userIds, CallView call) => _hub.Clients.Users(Ids(userIds)).SendAsync("CallUpdated", call);

    public Task CallEndedAsync(IEnumerable<long> userIds, CallView call)  => _hub.Clients.Users(Ids(userIds)).SendAsync("CallEnded", call);

    private static List<string> Ids(IEnumerable<long> userIds) => userIds.Select(id => id.ToString(CultureInfo.InvariantCulture)).ToList();
}
