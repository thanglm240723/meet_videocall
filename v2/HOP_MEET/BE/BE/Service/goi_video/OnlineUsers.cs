namespace BE.Service.goi_video
{
    // Dem so tab dang mo /hubs/calls cua moi user -> biet ai dang online de do chuong
    public class OnlineUsers
    {
        private readonly Dictionary<long, int> _count = new();
        private readonly object _lock = new();

        public void Add(long userId)
        {
            lock (_lock)
            {
                _count[userId] = _count.GetValueOrDefault(userId) + 1;
            }
        }

        public void Remove(long userId)
        {
            lock (_lock)
            {
                var left = _count.GetValueOrDefault(userId) - 1;
                if (left <= 0) _count.Remove(userId);
                else _count[userId] = left;
            }
        }

        public bool IsOnline(long userId)
        {
            lock (_lock)
            {
                return _count.ContainsKey(userId);
            }
        }
    }
}
