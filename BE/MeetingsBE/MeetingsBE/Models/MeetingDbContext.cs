using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace MeetingsBE.Models;

public partial class MeetingDbContext : DbContext
{
    public MeetingDbContext()
    {
    }

    public MeetingDbContext(DbContextOptions<MeetingDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Call> Calls { get; set; }

    public virtual DbSet<CallJoinLog> CallJoinLogs { get; set; }

    public virtual DbSet<CallJoinReq> CallJoinReqs { get; set; }

    public virtual DbSet<CallMember> CallMembers { get; set; }

    public virtual DbSet<Meeting> Meetings { get; set; }

    public virtual DbSet<MeetingInvite> MeetingInvites { get; set; }

    public virtual DbSet<MeetingJoinLog> MeetingJoinLogs { get; set; }

    public virtual DbSet<MeetingJoinReq> MeetingJoinReqs { get; set; }

    public virtual DbSet<MeetingMember> MeetingMembers { get; set; }

    public virtual DbSet<MeetingMessage> MeetingMessages { get; set; }

    public virtual DbSet<User> Users { get; set; }
    public DbSet<MeetingDailyRoom> MeetingDailyRooms => Set<MeetingDailyRoom>();
    public DbSet<CallDailyRoom> CallDailyRooms => Set<CallDailyRoom>();


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<MeetingDailyRoom>(entity =>
        {
            entity.ToTable("MeetingDailyRooms", "dbo");

            entity.HasKey(e => e.MeetingId)
                .HasName("PK_MeetingDailyRooms");

            entity.Property(e => e.MeetingId)
                .HasColumnName("meeting_id")
                .ValueGeneratedNever();

            entity.Property(e => e.DailyRoomName)
                .HasColumnName("daily_room_name")
                .HasMaxLength(128)
                .IsUnicode(false)
                .IsRequired();

            entity.Property(e => e.DailyRoomUrl)
                .HasColumnName("daily_room_url")
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(e => e.CreatedAt)
                .HasColumnName("created_at")
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");

            entity.HasIndex(e => e.DailyRoomName)
                .HasDatabaseName("UX_MeetingDailyRooms_Name")
                .IsUnique();

            entity.HasOne(e => e.Meeting)
                .WithOne(e => e.DailyRoom)
                .HasForeignKey<MeetingDailyRoom>(e => e.MeetingId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_MeetingDailyRooms_Meetings");
        });
        modelBuilder.Entity<CallDailyRoom>(entity =>
        {
            entity.ToTable("CallDailyRooms", "dbo");

            entity.HasKey(e => e.CallId).HasName("PK_CallDailyRooms");

            entity.Property(e => e.CallId)
                .HasColumnName("call_id")
                .ValueGeneratedNever();

            entity.Property(e => e.DailyRoomName)
                .HasColumnName("daily_room_name")
                .HasMaxLength(128)
                .IsUnicode(false)
                .IsRequired();

            entity.Property(e => e.DailyRoomUrl)
                .HasColumnName("daily_room_url")
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(e => e.CreatedAt)
                .HasColumnName("created_at")
                .HasPrecision(3);

            entity.Property(e => e.ExpiresAt)
                .HasColumnName("expires_at")
                .HasPrecision(3);

            entity.HasOne(e => e.Call)
                .WithOne(e => e.DailyRoom)
                .HasForeignKey<CallDailyRoom>(e => e.CallId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_CallDailyRooms_Call");
        });
        modelBuilder.Entity<Call>(entity =>
        {
            entity.ToTable("Call");

            entity.HasIndex(e => new { e.OwnerId, e.CreatedAt }, "IX_Call_Owner");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CallType)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("call_type");
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Call_CreatedAt")
                .HasColumnName("created_at");
            entity.Property(e => e.EndReason)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasColumnName("end_reason");
            entity.Property(e => e.EndedAt)
                .HasPrecision(3)
                .HasColumnName("ended_at");
            entity.Property(e => e.OwnerId).HasColumnName("owner_id");
            entity.Property(e => e.StartedAt)
                .HasPrecision(3)
                .HasColumnName("started_at");
            entity.Property(e => e.Status)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasDefaultValue("ringing", "DF_Call_Status")
                .HasColumnName("status");

            entity.HasOne(d => d.Owner).WithMany(p => p.Calls)
                .HasForeignKey(d => d.OwnerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Call_Owner");
        });

        modelBuilder.Entity<CallJoinLog>(entity =>
        {
            entity.ToTable("Call_join_log");

            entity.HasIndex(e => new { e.CallMemberId, e.JoinedAt }, "IX_CallJoinLog_Member");

            entity.HasIndex(e => e.CallMemberId, "UX_CallJoinLog_Open")
                .IsUnique()
                .HasFilter("([left_at] IS NULL)");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CallMemberId).HasColumnName("call_member_id");
            entity.Property(e => e.JoinedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_CallJoinLog_JoinedAt")
                .HasColumnName("joined_at");
            entity.Property(e => e.LeftAt)
                .HasPrecision(3)
                .HasColumnName("left_at");

            entity.HasOne(d => d.CallMember).WithMany(p => p.CallJoinLogs)
                .HasForeignKey(d => d.CallMemberId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CallJoinLog_Member");
        });

        modelBuilder.Entity<CallJoinReq>(entity =>
        {
            entity.ToTable("Call_join_req");

            entity.HasIndex(e => e.CallMemberId, "UQ_CallJoinReq_Member").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CallMemberId).HasColumnName("call_member_id");
            entity.Property(e => e.RequestedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_CallJoinReq_RequestedAt")
                .HasColumnName("requested_at");

            entity.HasOne(d => d.CallMember).WithOne(p => p.CallJoinReq)
                .HasForeignKey<CallJoinReq>(d => d.CallMemberId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CallJoinReq_Member");
        });

        modelBuilder.Entity<CallMember>(entity =>
        {
            entity.ToTable("Call_member");

            entity.HasIndex(e => new { e.UserId, e.InvitedAt }, "IX_CallMember_UserHistory").HasFilter("([user_id] IS NOT NULL)");

            entity.HasIndex(e => new { e.CallId, e.Email }, "UQ_CallMember_CallEmail").IsUnique();

            entity.HasIndex(e => new { e.CallId, e.UserId }, "UX_CallMember_CallUser")
                .IsUnique()
                .HasFilter("([user_id] IS NOT NULL)");

            entity.HasIndex(e => e.JoinTokenHash, "UX_CallMember_Token")
                .IsUnique()
                .HasFilter("([join_token_hash] IS NOT NULL)");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CallId).HasColumnName("call_id");
            entity.Property(e => e.DeliveryChannel)
                .HasMaxLength(15)
                .IsUnicode(false)
                .HasColumnName("delivery_channel");
            entity.Property(e => e.DeliveryStatus)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasDefaultValue("pending", "DF_CallMember_Delivery")
                .HasColumnName("delivery_status");
            entity.Property(e => e.DisplayName)
                .HasMaxLength(100)
                .HasColumnName("display_name");
            entity.Property(e => e.Email)
                .HasMaxLength(320)
                .HasColumnName("email");
            entity.Property(e => e.InvitedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_CallMember_InvitedAt")
                .HasColumnName("invited_at");
            entity.Property(e => e.JoinTokenHash)
                .HasMaxLength(32)
                .IsFixedLength()
                .HasColumnName("join_token_hash");
            entity.Property(e => e.RespondedAt)
                .HasPrecision(3)
                .HasColumnName("responded_at");
            entity.Property(e => e.ResponseStatus)
                .HasMaxLength(15)
                .IsUnicode(false)
                .HasDefaultValue("pending", "DF_CallMember_Response")
                .HasColumnName("response_status");
            entity.Property(e => e.Result)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("pending", "DF_CallMember_Result")
                .HasColumnName("result");
            entity.Property(e => e.RingExpiresAt)
                .HasPrecision(3)
                .HasColumnName("ring_expires_at");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.Call).WithMany(p => p.CallMembers)
                .HasForeignKey(d => d.CallId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CallMember_Call");

            entity.HasOne(d => d.User).WithMany(p => p.CallMembers)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_CallMember_User");
        });

        modelBuilder.Entity<Meeting>(entity =>
        {
            entity.HasIndex(e => new { e.OwnerId, e.CreatedAt }, "IX_Meetings_Owner");

            entity.HasIndex(e => new { e.Status, e.ScheduledStartAt }, "IX_Meetings_StatusStart");

            entity.HasIndex(e => e.JoinCode, "UX_Meetings_JoinCode")
                .IsUnique()
                .HasFilter("([join_code] IS NOT NULL)");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AdmissionMode)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("admission_mode");
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Meetings_CreatedAt")
                .HasColumnName("created_at");
            entity.Property(e => e.CreationMode)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("creation_mode");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.EndedAt)
                .HasPrecision(3)
                .HasColumnName("ended_at");
            entity.Property(e => e.JoinCode)
                .HasMaxLength(16)
                .IsUnicode(false)
                .HasColumnName("join_code");
            entity.Property(e => e.Location)
                .HasMaxLength(500)
                .HasColumnName("location");
            entity.Property(e => e.MeetingType)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("meeting_type");
            entity.Property(e => e.OpenEarlyMinutes).HasColumnName("open_early_minutes");
            entity.Property(e => e.OpenedAt)
                .HasPrecision(3)
                .HasColumnName("opened_at");
            entity.Property(e => e.OwnerId).HasColumnName("owner_id");
            entity.Property(e => e.ReminderSentAt)
                .HasPrecision(3)
                .HasColumnName("reminder_sent_at");
            entity.Property(e => e.ScheduledStartAt)
                .HasPrecision(3)
                .HasColumnName("scheduled_start_at");
            entity.Property(e => e.Status)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("status");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");
            entity.Property(e => e.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Meetings_UpdatedAt")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Owner).WithMany(p => p.Meetings)
                .HasForeignKey(d => d.OwnerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Meetings_Owner");
        });

        modelBuilder.Entity<MeetingInvite>(entity =>
        {
            entity.ToTable("Meeting_invites");

            entity.HasIndex(e => new { e.MeetingId, e.Email }, "UQ_Invites_MeetingEmail").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Invites_CreatedAt")
                .HasColumnName("created_at");
            entity.Property(e => e.DeliveryStatus)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasDefaultValue("pending", "DF_Invites_Delivery")
                .HasColumnName("delivery_status");
            entity.Property(e => e.Email)
                .HasMaxLength(320)
                .HasColumnName("email");
            entity.Property(e => e.LastSentAt)
                .HasPrecision(3)
                .HasColumnName("last_sent_at");
            entity.Property(e => e.MeetingId).HasColumnName("meeting_id");
            entity.Property(e => e.Response)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasDefaultValue("pending", "DF_Invites_Response")
                .HasColumnName("response");
            entity.Property(e => e.RespondedAt)
                .HasPrecision(3)
                .HasColumnName("responded_at");
            entity.Property(e => e.Attendance)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("attendance");
            entity.Property(e => e.AttendanceAt)
                .HasPrecision(3)
                .HasColumnName("attendance_at");

            entity.HasOne(d => d.Meeting).WithMany(p => p.MeetingInvites)
                .HasForeignKey(d => d.MeetingId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Invites_Meeting");
        });

        modelBuilder.Entity<MeetingJoinLog>(entity =>
        {
            entity.ToTable("Meeting_join_log");

            entity.HasIndex(e => new { e.MemberId, e.JoinedAt }, "IX_JoinLog_Member");

            entity.HasIndex(e => e.MemberId, "UX_JoinLog_Open")
                .IsUnique()
                .HasFilter("([left_at] IS NULL)");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.JoinedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_JoinLog_JoinedAt")
                .HasColumnName("joined_at");
            entity.Property(e => e.LeftAt)
                .HasPrecision(3)
                .HasColumnName("left_at");
            entity.Property(e => e.MemberId).HasColumnName("member_id");

            entity.HasOne(d => d.Member).WithOne(p => p.MeetingJoinLog)
                .HasForeignKey<MeetingJoinLog>(d => d.MemberId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_JoinLog_Member");
        });

        modelBuilder.Entity<MeetingJoinReq>(entity =>
        {
            entity.ToTable("Meeting_join_req");

            entity.HasIndex(e => new { e.MeetingId, e.UserId }, "UQ_JoinReq_MeetingUser").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MeetingId).HasColumnName("meeting_id");
            entity.Property(e => e.RequestedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_JoinReq_RequestedAt")
                .HasColumnName("requested_at");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.Meeting).WithMany(p => p.MeetingJoinReqs)
                .HasForeignKey(d => d.MeetingId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_JoinReq_Meeting");

            entity.HasOne(d => d.User).WithMany(p => p.MeetingJoinReqs)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_JoinReq_User");
        });

        modelBuilder.Entity<MeetingMember>(entity =>
        {
            entity.ToTable("Meeting_member");

            entity.HasIndex(e => new { e.MeetingId, e.Id }, "UQ_Member_MeetingId").IsUnique();

            entity.HasIndex(e => new { e.MeetingId, e.UserId }, "UQ_Member_MeetingUser").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Member_CreatedAt")
                .HasColumnName("created_at");
            entity.Property(e => e.DisplayName)
                .HasMaxLength(100)
                .HasColumnName("display_name");
            entity.Property(e => e.IsMutedByOwner).HasColumnName("is_muted_by_owner");
            entity.Property(e => e.MeetingId).HasColumnName("meeting_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.Meeting).WithMany(p => p.MeetingMembers)
                .HasForeignKey(d => d.MeetingId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Member_Meeting");

            entity.HasOne(d => d.User).WithMany(p => p.MeetingMembers)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Member_User");
        });

        modelBuilder.Entity<MeetingMessage>(entity =>
        {
            entity.ToTable("Meeting_message");

            entity.HasIndex(e => new { e.MeetingId, e.SentAt, e.Id }, "IX_Message_MeetingSent");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Content)
                .HasMaxLength(4000)
                .HasColumnName("content");
            entity.Property(e => e.MeetingId).HasColumnName("meeting_id");
            entity.Property(e => e.MemberId).HasColumnName("member_id");
            entity.Property(e => e.SentAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_Message_SentAt")
                .HasColumnName("sent_at");

            entity.HasOne(d => d.Meeting).WithMany(p => p.MeetingMessages)
                .HasForeignKey(d => d.MeetingId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Message_Meeting");

            entity.HasOne(d => d.MeetingMember).WithMany(p => p.MeetingMessages)
                .HasPrincipalKey(p => new { p.MeetingId, p.Id })
                .HasForeignKey(d => new { d.MeetingId, d.MemberId })
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Message_Member");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("User");

            entity.HasIndex(e => e.Email, "UQ_User_Email").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_User_CreatedAt")
                .HasColumnName("created_at");
            entity.Property(e => e.DisplayName)
                .HasMaxLength(100)
                .HasColumnName("display_name");
            entity.Property(e => e.Email)
                .HasMaxLength(320)
                .HasColumnName("email");
            entity.Property(e => e.PasswordHash)
                .HasMaxLength(200)
                .HasColumnName("password_hash");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
