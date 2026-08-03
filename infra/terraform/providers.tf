terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    cloudinit = {
      source  = "hashicorp/cloudinit"
      version = "~> 2.3"
    }
  }

  # Local backend for now. Uncomment and fill in to use remote S3 state.
  # backend "s3" {
  #   bucket         = "taskflow-terraform-state"
  #   key            = "eks/task-manager/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "taskflow-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
}
