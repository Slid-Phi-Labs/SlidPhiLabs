variable "name" { type = string }

resource "aws_ecs_cluster" "app" {
  name = var.name
}

resource "aws_ecs_task_definition" "app" {
  family                   = var.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  container_definitions = jsonencode([{
    name  = var.name
    image = "${var.name}:latest"
  }])
}
