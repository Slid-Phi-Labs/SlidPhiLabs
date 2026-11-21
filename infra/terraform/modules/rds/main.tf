variable "name" { type = string }

resource "aws_db_instance" "app" {
  identifier        = var.name
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = "db.t4g.micro"
  allocated_storage = 20
  username          = "lab"
  password          = "replace-before-apply"
  skip_final_snapshot = true
}
