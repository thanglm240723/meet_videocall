using System;
using System.Collections.Generic;

namespace MeetingsBE.Models;

public partial class User
{
    public long Id { get; private set; }

    public string Email { get; private set; } = null!;

    public string DisplayName { get; private set; } = null!;

    public string PasswordHash { get; private set; } = null!;

    public DateTime CreatedAt { get; private    set; }

    public virtual ICollection<CallMember> CallMembers { get; private set; } = new List<CallMember>();

    public virtual ICollection<Call> Calls { get; private set; } = new List<Call>();

    public virtual ICollection<MeetingJoinReq> MeetingJoinReqs { get; private set; } = new List<MeetingJoinReq>();

    public virtual ICollection<MeetingMember> MeetingMembers { get; private set; } = new List<MeetingMember>();

    public virtual ICollection<Meeting> Meetings { get; private set; } = new List<Meeting>();


    private User()
    {
    }

    private User (string email, string displayName)
    {
        Email = NormalizeEmail(email);
        DisplayName = displayName;
    }


    // passwordHash là chuỗi đã băm bằng IPasswordHasher, không phải mật khẩu gốc.
    public static User Create(string email, string displayName, string passwordHash)
    {
       if(string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("Email cannot be null or empty.", nameof(email));
        }
        if (string.IsNullOrWhiteSpace(displayName))
        {
            throw new ArgumentException("Display name cannot be null or empty.", nameof(displayName));
        }
        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            throw new ArgumentException("Password hash cannot be null or empty.", nameof(passwordHash));
        }
        return new User
        {
            Email = NormalizeEmail(email),
            DisplayName = displayName.Trim(),
            PasswordHash = passwordHash
        };
    }

    // Dùng khi PasswordHasher báo cần băm lại theo thuật toán mới.
    public void SetPasswordHash(string passwordHash)
    {
        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            throw new ArgumentException("Password hash cannot be null or empty.", nameof(passwordHash));
        }
        PasswordHash = passwordHash;
    }

    public static string NormalizeEmail(string email)
    {
        return email.Trim().ToLowerInvariant();
    }

  
}
