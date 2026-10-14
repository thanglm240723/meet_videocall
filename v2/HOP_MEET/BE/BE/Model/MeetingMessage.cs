namespace BE.Model
{
    
    public class MeetingMessage
    {
        public long Id { get; set; }
        public long MeetingId { get; set; }
        public long MemberId { get; set; }
        public string Content { get; set; } = null!;
        public DateTime SentAt { get; set; }

        public Meeting Meeting { get; set; } = null!;
        public MeetingMember Member { get; set; } = null!;
    }
}
