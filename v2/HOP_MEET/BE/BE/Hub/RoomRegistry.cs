using System.Collections.Concurrent;

namespace BE.Realtime
{
  
    public class RoomRegistry
    {
        private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, Peer>> _rooms = new();
        private readonly ConcurrentDictionary<string, Peer> _byConn = new();
        private readonly ConcurrentDictionary<string, WaitingPerson> _waiting = new();
        private readonly ConcurrentDictionary<string, RoomLocks> _locks = new();

        public List<Peer> Join(Peer p)
        {
            var room = _rooms.GetOrAdd(p.RoomId, _ => new());
            var others = room.Values.ToList();
            room[p.ConnectionId] = p;
            _byConn[p.ConnectionId] = p;
            return others;
        }

        public Peer? Leave(string connId)
        {
            if (!_byConn.TryRemove(connId, out var p)) return null;
            if (_rooms.TryGetValue(p.RoomId, out var room))
            {
                room.TryRemove(connId, out _);
                if (room.IsEmpty) _rooms.TryRemove(p.RoomId, out _);
            }
            return p;
        }

        public Peer? Get(string connId) => _byConn.GetValueOrDefault(connId);

        public List<Peer> GetPeers(string roomId) =>
            _rooms.TryGetValue(roomId, out var room) ? room.Values.ToList() : new List<Peer>();

        public bool SameRoom(string a, string b) =>
            _byConn.TryGetValue(a, out var pa) && _byConn.TryGetValue(b, out var pb) && pa.RoomId == pb.RoomId;

        public void AddWaiting(WaitingPerson w) => _waiting[w.ConnectionId] = w;

        public WaitingPerson? RemoveWaiting(string connId) =>
            _waiting.TryRemove(connId, out var w) ? w : null;

        public RoomLocks GetLocks(string roomId) => _locks.GetValueOrDefault(roomId, RoomLocks.None);

        public void SetLocks(string roomId, RoomLocks locks) => _locks[roomId] = locks;

        public void ClearLocks(string roomId) => _locks.TryRemove(roomId, out _);

        public List<WaitingPerson> GetWaiting(string roomId) =>
            _waiting.Values.Where(w => w.RoomId == roomId).ToList();
    }
}
