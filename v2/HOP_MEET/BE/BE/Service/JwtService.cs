using BE.Model;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace BE.Service
{
    public class JwtService : IJwtService
    {
        private readonly IConfiguration _config;

        public JwtService(IConfiguration config)
        {
            _config = config;
        }

        public (string Token, DateTime ExpiresAt) GenerateToken(User user)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
            var expiresAt = DateTime.UtcNow.AddMinutes(_config.GetValue("Jwt:ExpiresMinutes", 120));

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim("name", user.DisplayName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: expiresAt,
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

            return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
        }
    }
}
