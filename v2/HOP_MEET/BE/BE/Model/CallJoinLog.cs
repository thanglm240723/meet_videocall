namespace BE.Model
{
   
    public class CallJoinLog
    {
        public long Id { get; set; }
        public long CallMemberId { get; set; }
        public DateTime JoinedAt { get; set; }
        public DateTime? LeftAt { get; set; }

        public CallMember CallMember { get; set; } = null!;
    }
}
