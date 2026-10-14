namespace BE.Model
{
  
    public class Meeting
    {
        public long Id { get; set; }
        public long OwnerId { get; set; }
        public string Title { get; set; } = null!;
        public string? Description { get; set; }
        public string MeetingType { get; set; } = null!;
        public string CreationMode { get; set; } = null!;
        public DateTime? ScheduledStartAt { get; set; }
        public int? OpenEarlyMinutes { get; set; }
        public string? AdmissionMode { get; set; }
        public string? Location { get; set; }
        public string? JoinCode { get; set; }
        public string Status { get; set; } = null!;
        public DateTime? OpenedAt { get; set; }
        public DateTime? EndedAt { get; set; }
        public DateTime? ReminderSentAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public User Owner { get; set; } = null!;
        public ICollection<MeetingInvite> Invites { get; set; } = new List<MeetingInvite>();
        public ICollection<MeetingMember> Members { get; set; } = new List<MeetingMember>();
        public ICollection<MeetingJoinReq> JoinRequests { get; set; } = new List<MeetingJoinReq>();
        public ICollection<MeetingMessage> Messages { get; set; } = new List<MeetingMessage>();
    }
}
