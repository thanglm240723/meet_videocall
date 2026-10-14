using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace BE.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgres : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "User",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    display_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    password_hash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_User", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "Call",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    owner_id = table.Column<long>(type: "bigint", nullable: false),
                    call_type = table.Column<string>(type: "character varying(10)", unicode: false, maxLength: 10, nullable: false),
                    status = table.Column<string>(type: "character varying(10)", unicode: false, maxLength: 10, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')"),
                    started_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: true),
                    ended_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: true),
                    end_reason = table.Column<string>(type: "character varying(30)", unicode: false, maxLength: 30, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Call", x => x.id);
                    table.ForeignKey(
                        name: "FK_Call_Owner",
                        column: x => x.owner_id,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Meetings",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    owner_id = table.Column<long>(type: "bigint", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    meeting_type = table.Column<string>(type: "character varying(10)", unicode: false, maxLength: 10, nullable: false),
                    creation_mode = table.Column<string>(type: "character varying(10)", unicode: false, maxLength: 10, nullable: false),
                    scheduled_start_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: true),
                    open_early_minutes = table.Column<int>(type: "integer", nullable: true),
                    admission_mode = table.Column<string>(type: "character varying(10)", unicode: false, maxLength: 10, nullable: true),
                    location = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    join_code = table.Column<string>(type: "character varying(16)", unicode: false, maxLength: 16, nullable: true),
                    status = table.Column<string>(type: "character varying(10)", unicode: false, maxLength: 10, nullable: false),
                    opened_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: true),
                    ended_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: true),
                    reminder_sent_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')"),
                    updated_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Meetings", x => x.id);
                    table.ForeignKey(
                        name: "FK_Meetings_Owner",
                        column: x => x.owner_id,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Call_member",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    call_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: true),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    display_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    delivery_channel = table.Column<string>(type: "character varying(15)", unicode: false, maxLength: 15, nullable: false),
                    delivery_status = table.Column<string>(type: "character varying(10)", unicode: false, maxLength: 10, nullable: false),
                    invited_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')"),
                    ring_expires_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: true),
                    response_status = table.Column<string>(type: "character varying(15)", unicode: false, maxLength: 15, nullable: false),
                    responded_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: true),
                    result = table.Column<string>(type: "character varying(20)", unicode: false, maxLength: 20, nullable: false),
                    join_token_hash = table.Column<byte[]>(type: "bytea", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Call_member", x => x.id);
                    table.ForeignKey(
                        name: "FK_CallMember_Call",
                        column: x => x.call_id,
                        principalTable: "Call",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CallMember_User",
                        column: x => x.user_id,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Meeting_invites",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    meeting_id = table.Column<long>(type: "bigint", nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    delivery_status = table.Column<string>(type: "character varying(10)", unicode: false, maxLength: 10, nullable: false),
                    last_sent_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Meeting_invites", x => x.id);
                    table.ForeignKey(
                        name: "FK_Invites_Meeting",
                        column: x => x.meeting_id,
                        principalTable: "Meetings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Meeting_join_req",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    meeting_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    requested_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Meeting_join_req", x => x.id);
                    table.ForeignKey(
                        name: "FK_JoinReq_Meeting",
                        column: x => x.meeting_id,
                        principalTable: "Meetings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_JoinReq_User",
                        column: x => x.user_id,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Meeting_member",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    meeting_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    display_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    is_muted_by_owner = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Meeting_member", x => x.id);
                    table.UniqueConstraint("UQ_Member_MeetingId", x => new { x.meeting_id, x.id });
                    table.ForeignKey(
                        name: "FK_Member_Meeting",
                        column: x => x.meeting_id,
                        principalTable: "Meetings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Member_User",
                        column: x => x.user_id,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Call_join_log",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    call_member_id = table.Column<long>(type: "bigint", nullable: false),
                    joined_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')"),
                    left_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Call_join_log", x => x.id);
                    table.ForeignKey(
                        name: "FK_CallJoinLog_Member",
                        column: x => x.call_member_id,
                        principalTable: "Call_member",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Call_join_req",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    call_member_id = table.Column<long>(type: "bigint", nullable: false),
                    requested_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Call_join_req", x => x.id);
                    table.ForeignKey(
                        name: "FK_CallJoinReq_Member",
                        column: x => x.call_member_id,
                        principalTable: "Call_member",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Meeting_join_log",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    member_id = table.Column<long>(type: "bigint", nullable: false),
                    joined_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')"),
                    left_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Meeting_join_log", x => x.id);
                    table.ForeignKey(
                        name: "FK_JoinLog_Member",
                        column: x => x.member_id,
                        principalTable: "Meeting_member",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Meeting_message",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    meeting_id = table.Column<long>(type: "bigint", nullable: false),
                    member_id = table.Column<long>(type: "bigint", nullable: false),
                    content = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    sent_at = table.Column<DateTime>(type: "timestamp(3) without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Meeting_message", x => x.id);
                    table.ForeignKey(
                        name: "FK_Message_Meeting",
                        column: x => x.meeting_id,
                        principalTable: "Meetings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Message_Member",
                        columns: x => new { x.meeting_id, x.member_id },
                        principalTable: "Meeting_member",
                        principalColumns: new[] { "meeting_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Call_Owner",
                table: "Call",
                columns: new[] { "owner_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "UQ_CallJoinLog_OpenSession",
                table: "Call_join_log",
                column: "call_member_id",
                unique: true,
                filter: "left_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "UQ_CallJoinReq_Member",
                table: "Call_join_req",
                column: "call_member_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CallMember_UserHistory",
                table: "Call_member",
                columns: new[] { "user_id", "invited_at" });

            migrationBuilder.CreateIndex(
                name: "UQ_CallMember_CallEmail",
                table: "Call_member",
                columns: new[] { "call_id", "email" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_CallMember_CallUser",
                table: "Call_member",
                columns: new[] { "call_id", "user_id" },
                unique: true,
                filter: "user_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UQ_CallMember_Token",
                table: "Call_member",
                column: "join_token_hash",
                unique: true,
                filter: "join_token_hash IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UQ_Invites_MeetingEmail",
                table: "Meeting_invites",
                columns: new[] { "meeting_id", "email" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_JoinLog_OpenSession",
                table: "Meeting_join_log",
                column: "member_id",
                unique: true,
                filter: "left_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Meeting_join_req_user_id",
                table: "Meeting_join_req",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "UQ_JoinReq_MeetingUser",
                table: "Meeting_join_req",
                columns: new[] { "meeting_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Meeting_member_user_id",
                table: "Meeting_member",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "UQ_Member_MeetingUser",
                table: "Meeting_member",
                columns: new[] { "meeting_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Meeting_message_meeting_id_member_id",
                table: "Meeting_message",
                columns: new[] { "meeting_id", "member_id" });

            migrationBuilder.CreateIndex(
                name: "IX_Message_MeetingSent",
                table: "Meeting_message",
                columns: new[] { "meeting_id", "sent_at", "id" });

            migrationBuilder.CreateIndex(
                name: "IX_Meetings_Owner",
                table: "Meetings",
                columns: new[] { "owner_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_Meetings_StatusStart",
                table: "Meetings",
                columns: new[] { "status", "scheduled_start_at" });

            migrationBuilder.CreateIndex(
                name: "UQ_Meetings_JoinCode",
                table: "Meetings",
                column: "join_code",
                unique: true,
                filter: "join_code IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UQ_User_Email",
                table: "User",
                column: "email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Call_join_log");

            migrationBuilder.DropTable(
                name: "Call_join_req");

            migrationBuilder.DropTable(
                name: "Meeting_invites");

            migrationBuilder.DropTable(
                name: "Meeting_join_log");

            migrationBuilder.DropTable(
                name: "Meeting_join_req");

            migrationBuilder.DropTable(
                name: "Meeting_message");

            migrationBuilder.DropTable(
                name: "Call_member");

            migrationBuilder.DropTable(
                name: "Meeting_member");

            migrationBuilder.DropTable(
                name: "Call");

            migrationBuilder.DropTable(
                name: "Meetings");

            migrationBuilder.DropTable(
                name: "User");
        }
    }
}
