using System.ComponentModel.DataAnnotations;

namespace MeetingsBE.Dtos
{
    public class LoginRequest
    {
        [Required(ErrorMessage = "Vui lòng nhập email.")]
        public string Email { get; set; } = null!;

        [Required(ErrorMessage = "Vui lòng nhập mật khẩu.")]
        public string Password { get; set; } = null!;
    }
}
