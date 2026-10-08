using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddSandboxAndRetentionGuardrails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Servers_IsActive_NextCheckTime",
                table: "Servers");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Servers",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<bool>(
                name: "IsDefault",
                table: "Servers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SessionId",
                table: "Servers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ServerId1",
                table: "Pings",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pings_ServerId1",
                table: "Pings",
                column: "ServerId1");

            migrationBuilder.AddForeignKey(
                name: "FK_Pings_Servers_ServerId1",
                table: "Pings",
                column: "ServerId1",
                principalTable: "Servers",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Pings_Servers_ServerId1",
                table: "Pings");

            migrationBuilder.DropIndex(
                name: "IX_Pings_ServerId1",
                table: "Pings");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Servers");

            migrationBuilder.DropColumn(
                name: "IsDefault",
                table: "Servers");

            migrationBuilder.DropColumn(
                name: "SessionId",
                table: "Servers");

            migrationBuilder.DropColumn(
                name: "ServerId1",
                table: "Pings");

            migrationBuilder.CreateIndex(
                name: "IX_Servers_IsActive_NextCheckTime",
                table: "Servers",
                columns: new[] { "IsActive", "NextCheckTime" });
        }
    }
}
