namespace MeetingsBE.Service;

public sealed class CallPresence
{
    private readonly object _gate = new();
    private readonly Dictionary<long, HashSet<string>> _connections = new();
    private readonly Dictionary<long, DateTime> _offlineSince = new();

    public void Connected(long userId, string connectionId)
    {
        lock (_gate)
        {
            if (!_connections.TryGetValue(userId, out var set))
                _connections[userId] = set = new HashSet<string>();

            set.Add(connectionId);
            _offlineSince.Remove(userId);
        }
    }

    public void Disconnected(long userId, string connectionId, DateTime now)
    {
        lock (_gate)
        {
            if (!_connections.TryGetValue(userId, out var set))
                return;

            set.Remove(connectionId);

            if (set.Count == 0)
            {
                _connections.Remove(userId);
                _offlineSince[userId] = now;
            }
        }
    }

    public bool IsOnline(long userId)
    {
        lock (_gate)
            return _connections.ContainsKey(userId);
    }

    public List<long> TakeOfflineBefore(DateTime cutoff)
    {
        lock (_gate)
        {
            var users = _offlineSince
                .Where(p => p.Value <= cutoff)
                .Select(p => p.Key)
                .ToList();

            foreach (var id in users)
                _offlineSince.Remove(id);

            return users;
        }
    }
}
