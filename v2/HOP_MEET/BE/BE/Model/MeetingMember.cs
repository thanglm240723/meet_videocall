namespace BE.Model
{
   
    public class MeetingMember
    {
        public long Id { get; set; }
        public long MeetingId { get; set; }
        public long UserId { get; set; }
        public string DisplayName { get; set; } = null!;
        public bool IsMutedByOwner { get; set; }
        public DateTime CreatedAt { get; set; }

        public Meeting Meeting { get; set; } = null!;
        public User User { get; set; } = null!;
        public ICollection<MeetingJoinLog> JoinLogs { get; set; } = new List<MeetingJoinLog>();
        public ICollection<MeetingMessage> Messages { get; set; } = new List<MeetingMessage>();
    }
}
