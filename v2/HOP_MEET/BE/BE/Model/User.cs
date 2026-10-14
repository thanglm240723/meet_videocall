namespace BE.Model
{
    public sealed class User
    {
        public long Id { get; private set; }
        public string Email { get; private set; } = null!;
        public string DisplayName { get; private set; } = null!;
        public string PasswordHash { get; private set; } = null!;
        public DateTime CreatedAt { get; private set; }

        public ICollection<Meeting> OwnedMeetings { get; private set; } = new List<Meeting>();
        public ICollection<MeetingMember> MeetingMemberships { get; private set; } = new List<MeetingMember>();
        public ICollection<Call> OwnedCalls { get; private set; } = new List<Call>();

        private User() { }

        public static User Create(string displayName, string email, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(displayName))
                throw new ArgumentException("Display name cannot be empty.", nameof(displayName));
            if (string.IsNullOrWhiteSpace(email))
                throw new ArgumentException("Email cannot be empty.", nameof(email));

            return new User
            {
                DisplayName = displayName.Trim(),
                Email = NormalizeEmail(email),
                CreatedAt = now
            };
        }

        public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

        public void SetPasswordHash(string hash) => PasswordHash = hash;

        public void UpdateDisplayName(string displayName)
        {
            if (string.IsNullOrWhiteSpace(displayName))
                throw new ArgumentException("Display name cannot be empty.", nameof(displayName));
            DisplayName = displayName.Trim();
        }
    }
}
