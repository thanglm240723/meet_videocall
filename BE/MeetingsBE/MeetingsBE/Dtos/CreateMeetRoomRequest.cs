using System.ComponentModel.DataAnnotations;

namespace MeetingsBE.Dtos
{
    public class CreateMeetRoomRequest
    {
        [Required, StringLength(200)]
        public string Title { get; set; } = null!;

        public string? Description { get; set; }

        [Required, StringLength(10)]
        public string CreationMode { get; set; } = null!;

        public DateTime? ScheduledStartAt { get; set; }

        [StringLength(10)]
        public string? AdmissionMode { get; set; }

        [StringLength(500)]
        public string? Location { get; set; }
    }
}

