terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.24"
    }
  }

  # IMPORTANT: The S3 bucket and DynamoDB table for state locking must be
  # pre-provisioned before running `terraform init`. The bucket name must be
  # globally unique. Run the following once per AWS account:
  #
  #   aws s3api create-bucket --bucket brand-os-terraform-state --region us-east-1
  #   aws s3api put-bucket-versioning --bucket brand-os-terraform-state \
  #     --versioning-configuration Status=Enabled
  #   aws dynamodb create-table --table-name brand-os-terraform-locks \
  #     --attribute-definitions AttributeName=LockID,AttributeType=S \
  #     --key-schema AttributeName=LockID,KeyType=HASH \
  #     --billing-mode PAY_PER_REQUEST --region us-east-1
  #
  # Alternatively, use `terraform init -backend-config=backend.hcl` to
  # supply a different bucket name without editing this file.
  backend "s3" {
    bucket         = "brand-os-terraform-state"
    key            = "brand-os/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "brand-os-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region to deploy Brand OS infrastructure"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "brand-os"
}

variable "nat_gateway_count" {
  description = "Number of NAT gateways to provision. Use 1 for dev/staging (cost-optimised), 2 for production HA."
  type        = number
  default     = 1

  validation {
    condition     = var.nat_gateway_count >= 1 && var.nat_gateway_count <= 2
    error_message = "nat_gateway_count must be 1 or 2."
  }
}
