using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BE.Migrations
{
    /// <inheritdoc />
    public partial class ScheduleResponseAttendance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "attendance",
                table: "Meeting_invites",
                type: "character varying(10)",
                unicode: false,
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "responded_at",
                table: "Meeting_invites",
                type: "timestamp(3) without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "response",
                table: "Meeting_invites",
                type: "character varying(10)",
                unicode: false,
                maxLength: 10,
                nullable: false,
                defaultValue: "pending");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "attendance",
                table: "Meeting_invites");

            migrationBuilder.DropColumn(
                name: "responded_at",
                table: "Meeting_invites");

            migrationBuilder.DropColumn(
                name: "response",
                table: "Meeting_invites");
        }
    }
}
