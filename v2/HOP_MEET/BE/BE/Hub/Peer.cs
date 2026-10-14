namespace BE.Realtime
{
    public class Peer
    {
        public required string ConnectionId { get; init; }
        public required string RoomId { get; init; }
        public long? MeetingId { get; init; }
        public long? MemberId { get; init; }    
        public long? CallId { get; init; }
        public required long UserId { get; init; }
        public required string DisplayName { get; init; }
        public bool IsOwner { get; init; }
        public bool Mic { get; set; }
        public bool Cam { get; set; }
        public string? ScreenStreamId { get; set; }
        public long? HandRaisedAt { get; set; }
    }
    public record RoomLocks(bool Mic, bool Cam, bool Screen)
    {
        public static readonly RoomLocks None = new(false, false, false);
    }

    public record WaitingPerson(string ConnectionId, string RoomId, long MeetingId, long UserId, string Name);
}
