# Modules only. This file does not apply anything and does not spend money.
# Region for this lab is us-east-2.

variable "region" {
  type    = string
  default = "us-east-2"
}

variable "name" {
  type    = string
  default = "slid-phi-labs"
}

provider "aws" {
  region = var.region
}

module "ecr" {
  source = "./modules/ecr"
  name   = var.name
}

module "ecs" {
  source = "./modules/ecs"
  name   = var.name
}

module "rds" {
  source = "./modules/rds"
  name   = var.name
}

module "cache" {
  source = "./modules/elasticache"
  name   = var.name
}
