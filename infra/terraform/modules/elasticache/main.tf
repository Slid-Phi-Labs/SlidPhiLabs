variable "name" { type = string }

resource "aws_elasticache_cluster" "app" {
  cluster_id           = var.name
  engine               = "redis"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
}
