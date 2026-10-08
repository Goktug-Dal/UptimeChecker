using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class FixPingForeignKeyShadowColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Pings_Servers_ServerId1",
                table: "Pings");

            migrationBuilder.DropIndex(
                name: "IX_Pings_ServerId1",
                table: "Pings");

            migrationBuilder.DropColumn(
                name: "ServerId1",
                table: "Pings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
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
    }
}
