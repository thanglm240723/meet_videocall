namespace BE.Model
{
    
    public class MeetingJoinLog
    {
        public long Id { get; set; }
        public long MemberId { get; set; }
        public DateTime JoinedAt { get; set; }
        public DateTime? LeftAt { get; set; }

        public MeetingMember Member { get; set; } = null!;
    }
}
