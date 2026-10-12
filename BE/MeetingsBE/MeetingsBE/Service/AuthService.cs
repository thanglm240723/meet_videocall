using MeetingsBE.Dtos;
using MeetingsBE.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using static MeetingsBE.Service.IAutheService;

namespace MeetingsBE.Service
{
    public sealed class AuthService : IAutheService
    {
        private readonly MeetingDbContext _context;
        private readonly IPasswordHasher<User> _passwordHasher;

        public AuthService(MeetingDbContext context, IPasswordHasher<User> passwordHasher)
        {
            _context = context;
            _passwordHasher = passwordHasher;
        }

        public async Task<AuthResult> RegisterAsync(RegisterRequest request, CancellationToken ct)
        {
            var email = User.NormalizeEmail(request.Email);

            if (await _context.Users.AnyAsync(u => u.Email == email, ct))
            {
                return new(AuthError.EmailTaken);
            }

            var passwordHash = _passwordHasher.HashPassword(null!, request.Password);
            var user = User.Create(email, request.DisplayName, passwordHash);

            _context.Users.Add(user);
            await _context.SaveChangesAsync(ct);

            return new(AuthError.None, user);
        }

        public async Task<AuthResult> LoginAsync(LoginRequest request, CancellationToken ct)
        {
            var email = User.NormalizeEmail(request.Email);

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

            if (user == null)
            {
                return new(AuthError.InvalidCredentials);
            }

            var result = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);

            if (result == PasswordVerificationResult.Failed)
            {
                return new(AuthError.InvalidCredentials);
            }

            return new(AuthError.None, user);
        }

        public Task<User?> GetByIdAsync(long userId, CancellationToken ct)
            => _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
    }
}
