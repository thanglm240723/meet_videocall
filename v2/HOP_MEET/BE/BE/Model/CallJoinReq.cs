namespace BE.Model
{
    
    public class CallJoinReq
    {
        public long Id { get; set; }
        public long CallMemberId { get; set; }
        public DateTime RequestedAt { get; set; }

        public CallMember CallMember { get; set; } = null!;
    }
}
