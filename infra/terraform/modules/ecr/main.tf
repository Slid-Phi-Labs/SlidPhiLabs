variable "name" { type = string }

resource "aws_ecr_repository" "app" {
  name = var.name
  image_scanning_configuration { scan_on_push = true }
}
