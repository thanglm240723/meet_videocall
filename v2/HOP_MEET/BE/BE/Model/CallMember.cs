namespace BE.Model
{
   
    public class CallMember
    {
        public long Id { get; set; }
        public long CallId { get; set; }
        public long? UserId { get; set; }
        public string Email { get; set; } = null!;
        public string? DisplayName { get; set; }
        public string DeliveryChannel { get; set; } = null!;
        public string DeliveryStatus { get; set; } = null!;
        public DateTime InvitedAt { get; set; }
        public DateTime? RingExpiresAt { get; set; }
        public string ResponseStatus { get; set; } = null!;
        public DateTime? RespondedAt { get; set; }
        public string Result { get; set; } = null!;
        public byte[]? JoinTokenHash { get; set; }

        public Call Call { get; set; } = null!;
        public User? User { get; set; }
        public CallJoinReq? JoinRequest { get; set; }
        public ICollection<CallJoinLog> JoinLogs { get; set; } = new List<CallJoinLog>();
    }
}
