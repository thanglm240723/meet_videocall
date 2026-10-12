using System.Globalization;
using MeetingsBE.Dtos;
using Microsoft.AspNetCore.SignalR;

namespace MeetingsBE.Hubs;

public interface IScheduleNotifier
{
    Task ScheduleChangedAsync(IEnumerable<long> userIds, ScheduleNotice notice);
}

public sealed class ScheduleNotifier : IScheduleNotifier
{
    private readonly IHubContext<CallHub> _hub;

    public ScheduleNotifier(IHubContext<CallHub> hub)
    {
        _hub = hub;
    }

    public Task ScheduleChangedAsync(IEnumerable<long> userIds, ScheduleNotice notice)
    {
        var ids = userIds.Select(id => id.ToString(CultureInfo.InvariantCulture)).ToList();

        return ids.Count == 0? Task.CompletedTask : _hub.Clients.Users(ids).SendAsync("ScheduleChanged", notice);
    }
}
