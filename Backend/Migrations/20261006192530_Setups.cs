using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class Setups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Pings_Servers_ServerId",
                table: "Pings");

            migrationBuilder.DropColumn(
                name: "MonitorId",
                table: "Pings");

            migrationBuilder.RenameColumn(
                name: "IsSucess",
                table: "Pings",
                newName: "IsSuccess");

            migrationBuilder.AlterColumn<int>(
                name: "ServerId",
                table: "Pings",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Pings_Servers_ServerId",
                table: "Pings",
                column: "ServerId",
                principalTable: "Servers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Pings_Servers_ServerId",
                table: "Pings");

            migrationBuilder.RenameColumn(
                name: "IsSuccess",
                table: "Pings",
                newName: "IsSucess");

            migrationBuilder.AlterColumn<int>(
                name: "ServerId",
                table: "Pings",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<int>(
                name: "MonitorId",
                table: "Pings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddForeignKey(
                name: "FK_Pings_Servers_ServerId",
                table: "Pings",
                column: "ServerId",
                principalTable: "Servers",
                principalColumn: "Id");
        }
    }
}
