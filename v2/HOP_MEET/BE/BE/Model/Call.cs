namespace BE.Model
{
    public class Call
    {
        public long Id { get; set; }
        public long OwnerId { get; set; }
        public string CallType { get; set; } = null!;
        public string Status { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? EndedAt { get; set; }
        public string? EndReason { get; set; }

        public User Owner { get; set; } = null!;
        public ICollection<CallMember> Members { get; set; } = new List<CallMember>();
    }
}
