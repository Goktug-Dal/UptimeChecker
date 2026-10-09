using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPingIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Pings_ServerId",
                table: "Pings");

            migrationBuilder.CreateIndex(
                name: "IX_Pings_CheckedAt",
                table: "Pings",
                column: "CheckedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Pings_ServerId_CheckedAt",
                table: "Pings",
                columns: new[] { "ServerId", "CheckedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Pings_CheckedAt",
                table: "Pings");

            migrationBuilder.DropIndex(
                name: "IX_Pings_ServerId_CheckedAt",
                table: "Pings");

            migrationBuilder.CreateIndex(
                name: "IX_Pings_ServerId",
                table: "Pings",
                column: "ServerId");
        }
    }
}
