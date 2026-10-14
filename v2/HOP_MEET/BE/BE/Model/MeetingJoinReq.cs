namespace BE.Model
{
    
    public class MeetingJoinReq
    {
        public long Id { get; set; }
        public long MeetingId { get; set; }
        public long UserId { get; set; }
        public DateTime RequestedAt { get; set; }

        public Meeting Meeting { get; set; } = null!;
        public User User { get; set; } = null!;
    }
}
