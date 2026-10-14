using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BE.Controllers
{
    [ApiController]
    [Route("api/webrtc")]
    [Authorize]
    public class WebRtcController : Controller
    {
        private readonly IConfiguration cfg;

        public WebRtcController(IConfiguration cfg)
        {
            this.cfg = cfg;
        }

        // GET api/webrtc/ice -> dung lam RTCConfiguration o FE
        [HttpGet("ice")]
        public IActionResult LayCauHinhKetNoiAsync()
        {
            var host = cfg["TURN:Host"];
            var secret = cfg["TURN:Secret"];

            // chua cau hinh TURN (luc dev) thi dung tam STUN cua Google
            if (string.IsNullOrEmpty(host) || string.IsNullOrEmpty(secret))
            {
                return Ok(new
                {
                    iceServers = new object[]
                    {
                        new { urls = new[] { "stun:stun.l.google.com:19302" } },
                    }
                });
            }

            // coturn use-auth-secret: username = "het_han:userId", password = base64(HMAC-SHA1(secret, username))
            var expiry = DateTimeOffset.UtcNow.AddHours(12).ToUnixTimeSeconds();
            var username = $"{expiry}:{User.FindFirst("sub")?.Value}";
            using var hmac = new HMACSHA1(Encoding.UTF8.GetBytes(secret));
            var credential = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(username)));

            return Ok(new
            {
                iceServers = new object[]
                {
                    new { urls = new[] { $"stun:{host}:3478" } },
                    new
                    {
                        urls = new[] { $"turn:{host}:3478?transport=udp", $"turn:{host}:3478?transport=tcp" },
                        username,
                        credential,
                    },
                }
            });
        }
    }
}
