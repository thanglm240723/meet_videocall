namespace BE.Model
{
  
    public class MeetingInvite
    {
        public long Id { get; set; }
        public long MeetingId { get; set; }
        public string Email { get; set; } = null!;
        public string DeliveryStatus { get; set; } = null!;
        public DateTime? LastSentAt { get; set; }
        public DateTime CreatedAt { get; set; }

       
        public string Response { get; set; } = "pending";
        public DateTime? RespondedAt { get; set; }
        public string? Attendance { get; set; }

        public Meeting Meeting { get; set; } = null!;
    }
}
