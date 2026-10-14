using BE.Model;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace BE.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users => Set<User>();
        public DbSet<Meeting> Meetings => Set<Meeting>();
        public DbSet<MeetingInvite> MeetingInvites => Set<MeetingInvite>();
        public DbSet<MeetingMember> MeetingMembers => Set<MeetingMember>();
        public DbSet<MeetingJoinReq> MeetingJoinReqs => Set<MeetingJoinReq>();
        public DbSet<MeetingJoinLog> MeetingJoinLogs => Set<MeetingJoinLog>();
        public DbSet<MeetingMessage> MeetingMessages => Set<MeetingMessage>();
        public DbSet<Call> Calls => Set<Call>();
        public DbSet<CallMember> CallMembers => Set<CallMember>();
        public DbSet<CallJoinReq> CallJoinReqs => Set<CallJoinReq>();
        public DbSet<CallJoinLog> CallJoinLogs => Set<CallJoinLog>();

        private const string UtcNow = "(now() at time zone 'utc')";

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>(e =>
            {
                e.ToTable("User");
                e.HasKey(x => x.Id).HasName("PK_User");
                e.Property(x => x.Email).IsRequired().HasMaxLength(320);
                e.Property(x => x.DisplayName).IsRequired().HasMaxLength(100);
                e.Property(x => x.PasswordHash).IsRequired().HasMaxLength(255);
                e.Property(x => x.CreatedAt).HasDefaultValueSql(UtcNow);
                e.HasIndex(x => x.Email).IsUnique().HasDatabaseName("UQ_User_Email");
            });

            modelBuilder.Entity<Meeting>(e =>
            {
                e.ToTable("Meetings");
                e.HasKey(x => x.Id).HasName("PK_Meetings");
                e.Property(x => x.Title).IsRequired().HasMaxLength(200);
                e.Property(x => x.MeetingType).IsRequired().HasMaxLength(10).IsUnicode(false);
                e.Property(x => x.CreationMode).IsRequired().HasMaxLength(10).IsUnicode(false);
                e.Property(x => x.AdmissionMode).HasMaxLength(10).IsUnicode(false);
                e.Property(x => x.Location).HasMaxLength(500);
                e.Property(x => x.JoinCode).HasMaxLength(16).IsUnicode(false);
                e.Property(x => x.Status).IsRequired().HasMaxLength(10).IsUnicode(false);
                e.Property(x => x.CreatedAt).HasDefaultValueSql(UtcNow);
                e.Property(x => x.UpdatedAt).HasDefaultValueSql(UtcNow);

                e.HasIndex(x => new { x.OwnerId, x.CreatedAt }).HasDatabaseName("IX_Meetings_Owner");
                e.HasIndex(x => new { x.Status, x.ScheduledStartAt }).HasDatabaseName("IX_Meetings_StatusStart");
                e.HasIndex(x => x.JoinCode).IsUnique().HasFilter("join_code IS NOT NULL")
                    .HasDatabaseName("UQ_Meetings_JoinCode");

                e.HasOne(x => x.Owner).WithMany(u => u.OwnedMeetings).HasForeignKey(x => x.OwnerId)
                    .OnDelete(DeleteBehavior.Restrict).HasConstraintName("FK_Meetings_Owner");
            });

            modelBuilder.Entity<MeetingInvite>(e =>
            {
                e.ToTable("Meeting_invites");
                e.HasKey(x => x.Id).HasName("PK_Meeting_invites");
                e.Property(x => x.Email).IsRequired().HasMaxLength(320);
                e.Property(x => x.DeliveryStatus).IsRequired().HasMaxLength(10).IsUnicode(false);
                e.Property(x => x.Response).IsRequired().HasMaxLength(10).IsUnicode(false).HasDefaultValue("pending");
                e.Property(x => x.Attendance).HasMaxLength(10).IsUnicode(false);
                e.Property(x => x.CreatedAt).HasDefaultValueSql(UtcNow);

                e.HasIndex(x => new { x.MeetingId, x.Email }).IsUnique().HasDatabaseName("UQ_Invites_MeetingEmail");

                e.HasOne(x => x.Meeting).WithMany(m => m.Invites).HasForeignKey(x => x.MeetingId)
                    .OnDelete(DeleteBehavior.Restrict).HasConstraintName("FK_Invites_Meeting");
            });

            modelBuilder.Entity<MeetingMember>(e =>
            {
                e.ToTable("Meeting_member");
                e.HasKey(x => x.Id).HasName("PK_Meeting_member");
                e.Property(x => x.DisplayName).IsRequired().HasMaxLength(100);
                e.Property(x => x.IsMutedByOwner).HasDefaultValue(false);
                e.Property(x => x.CreatedAt).HasDefaultValueSql(UtcNow);

                e.HasIndex(x => new { x.MeetingId, x.UserId }).IsUnique().HasDatabaseName("UQ_Member_MeetingUser");
                e.HasAlternateKey(x => new { x.MeetingId, x.Id }).HasName("UQ_Member_MeetingId");

                e.HasOne(x => x.Meeting).WithMany(m => m.Members).HasForeignKey(x => x.MeetingId)
                    .OnDelete(DeleteBehavior.Restrict).HasConstraintName("FK_Member_Meeting");
                e.HasOne(x => x.User).WithMany(u => u.MeetingMemberships).HasForeignKey(x => x.UserId)
                    .OnDelete(DeleteBehavior.Restrict).HasConstraintName("FK_Member_User");
            });

            modelBuilder.Entity<MeetingJoinReq>(e =>
            {
                e.ToTable("Meeting_join_req");
                e.HasKey(x => x.Id).HasName("PK_Meeting_join_req");
                e.Property(x => x.RequestedAt).HasDefaultValueSql(UtcNow);

                e.HasIndex(x => new { x.MeetingId, x.UserId }).IsUnique().HasDatabaseName("UQ_JoinReq_MeetingUser");

                e.HasOne(x => x.Meeting).WithMany(m => m.JoinRequests).HasForeignKey(x => x.MeetingId)
                    .OnDelete(DeleteBehavior.Restrict).HasConstraintName("FK_JoinReq_Meeting");
                e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId)
                    .OnDelete(DeleteBehavior.Restrict).HasConstraintName("FK_JoinReq_User");
            });

            modelBuilder.Entity<MeetingJoinLog>(e =>
            {
                e.ToTable("Meeting_join_log");
                e.HasKey(x => x.Id).HasName("PK_Meeting_join_log");
                e.Property(x => x.JoinedAt).HasDefaultValueSql(UtcNow);

                e.HasIndex(x => x.MemberId).IsUnique().HasFilter("left_at IS NULL")
                    .HasDatabaseName("UQ_JoinLog_OpenSession");

                e.HasOne(x => x.Member).WithMany(m => m.JoinLogs).HasForeignKey(x => x.MemberId)
                    .OnDelete(DeleteBehavior.Restrict).HasConstraintName("FK_JoinLog_Member");
            });

            modelBuilder.Entity<MeetingMessage>(e =>
            {
                e.ToTable("Meeting_message");
                e.HasKey(x => x.Id).HasName("PK_Meeting_message");
                e.Property(x => x.Content).IsRequired().HasMaxLength(4000);
                e.Property(x => x.SentAt).HasDefaultValueSql(UtcNow);

                e.HasIndex(x => new { x.MeetingId, x.SentAt, x.Id }).HasDatabaseName("IX_Message_MeetingSent");

                e.HasOne(x => x.Meeting).WithMany(m => m.Messages).HasForeignKey(x => x.MeetingId)
                    .OnDelete(DeleteBehavior.Restrict).HasConstraintName("FK_Message_Meeting");
                e.HasOne(x => x.Member).WithMany(m => m.Messages)
                    .HasForeignKey(x => new { x.MeetingId, x.MemberId })
                    .HasPrincipalKey(m => new { m.MeetingId, m.Id })
                    .OnDelete(DeleteBehavior.Restrict).HasConstraintName("FK_Message_Member");
            });

            modelBuilder.Entity<Call>(e =>
            {
                e.ToTable("Call");
                e.HasKey(x => x.Id).HasName("PK_Call");
                e.Property(x => x.CallType).IsRequired().HasMaxLength(10).IsUnicode(false);
                e.Property(x => x.Status).IsRequired().HasMaxLength(10).IsUnicode(false);
                e.Property(x => x.EndReason).HasMaxLength(30).IsUnicode(false);
                e.Property(x => x.CreatedAt).HasDefaultValueSql(UtcNow);

                e.HasIndex(x => new { x.OwnerId, x.CreatedAt }).HasDatabaseName("IX_Call_Owner");

                e.HasOne(x => x.Owner).WithMany(u => u.OwnedCalls).HasForeignKey(x => x.OwnerId)
                    .OnDelete(DeleteBehavior.Restrict).HasConstraintName("FK_Call_Owner");
            });

            modelBuilder.Entity<CallMember>(e =>
            {
                e.ToTable("Call_member");
                e.HasKey(x => x.Id).HasName("PK_Call_member");
                e.Property(x => x.Email).IsRequired().HasMaxLength(320);
                e.Property(x => x.DisplayName).HasMaxLength(100);
                e.Property(x => x.DeliveryChannel).IsRequired().HasMaxLength(15).IsUnicode(false);
                e.Property(x => x.DeliveryStatus).IsRequired().HasMaxLength(10).IsUnicode(false);
                e.Property(x => x.InvitedAt).HasDefaultValueSql(UtcNow);
                e.Property(x => x.ResponseStatus).IsRequired().HasMaxLength(15).IsUnicode(false);
                e.Property(x => x.Result).IsRequired().HasMaxLength(20).IsUnicode(false);
                e.Property(x => x.JoinTokenHash).HasColumnType("bytea");

                e.HasIndex(x => new { x.CallId, x.Email }).IsUnique().HasDatabaseName("UQ_CallMember_CallEmail");
                e.HasIndex(x => new { x.UserId, x.InvitedAt }).HasDatabaseName("IX_CallMember_UserHistory");
                e.HasIndex(x => new { x.CallId, x.UserId }).IsUnique().HasFilter("user_id IS NOT NULL")
                    .HasDatabaseName("UQ_CallMember_CallUser");
                e.HasIndex(x => x.JoinTokenHash).IsUnique().HasFilter("join_token_hash IS NOT NULL")
                    .HasDatabaseName("UQ_CallMember_Token");

                e.HasOne(x => x.Call).WithMany(c => c.Members).HasForeignKey(x => x.CallId)
                    .OnDelete(DeleteBehavior.Restrict).HasConstraintName("FK_CallMember_Call");
                e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId)
                    .OnDelete(DeleteBehavior.Restrict).HasConstraintName("FK_CallMember_User");
            });

            modelBuilder.Entity<CallJoinReq>(e =>
            {
                e.ToTable("Call_join_req");
                e.HasKey(x => x.Id).HasName("PK_Call_join_req");
                e.Property(x => x.RequestedAt).HasDefaultValueSql(UtcNow);

                e.HasIndex(x => x.CallMemberId).IsUnique().HasDatabaseName("UQ_CallJoinReq_Member");

                e.HasOne(x => x.CallMember).WithOne(m => m.JoinRequest).HasForeignKey<CallJoinReq>(x => x.CallMemberId)
                    .OnDelete(DeleteBehavior.Restrict).HasConstraintName("FK_CallJoinReq_Member");
            });

            modelBuilder.Entity<CallJoinLog>(e =>
            {
                e.ToTable("Call_join_log");
                e.HasKey(x => x.Id).HasName("PK_Call_join_log");
                e.Property(x => x.JoinedAt).HasDefaultValueSql(UtcNow);

                e.HasIndex(x => x.CallMemberId).IsUnique().HasFilter("left_at IS NULL")
                    .HasDatabaseName("UQ_CallJoinLog_OpenSession");

                e.HasOne(x => x.CallMember).WithMany(m => m.JoinLogs).HasForeignKey(x => x.CallMemberId)
                    .OnDelete(DeleteBehavior.Restrict).HasConstraintName("FK_CallJoinLog_Member");
            });

            
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entity.GetProperties())
                {
                    property.SetColumnName(ToSnakeCase(property.Name));
                    if (property.ClrType == typeof(DateTime) || property.ClrType == typeof(DateTime?))
                        property.SetColumnType("timestamp(3)");
                }
            }
        }

        private static string ToSnakeCase(string name) =>
            Regex.Replace(name, "(?<=[a-z0-9])([A-Z])", "_$1").ToLowerInvariant();
    }
}
