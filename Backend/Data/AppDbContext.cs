using Backend.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Api.Context;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Ping> Pings => Set<Ping>();
    public DbSet<Server> Servers => Set<Server>();

  protected override void OnModelCreating(ModelBuilder modelBuilder)
  {
    base.OnModelCreating(modelBuilder);
    modelBuilder.Entity<Server>().HasIndex(s => new {s.IsActive, s.NextCheckTime});
  }
}