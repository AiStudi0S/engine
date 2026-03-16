################################################################################
# EKS Cluster
################################################################################
resource "aws_eks_cluster" "brand_os" {
  name     = var.cluster_name
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.29"

  vpc_config {
    subnet_ids = aws_subnet.private[*].id
  }

  tags = {
    Environment = var.environment
    Project     = "brand-os"
  }
}

resource "aws_eks_node_group" "standard" {
  cluster_name    = aws_eks_cluster.brand_os.name
  node_group_name = "standard"
  node_role_arn   = aws_iam_role.eks_node.arn
  subnet_ids      = aws_subnet.private[*].id

  scaling_config {
    desired_size = 3
    max_size     = 10
    min_size     = 1
  }

  instance_types = ["t3.large"]

  tags = {
    Environment = var.environment
  }
}

################################################################################
# RDS PostgreSQL
################################################################################
resource "aws_db_instance" "brand_os" {
  identifier           = "brand-os-${var.environment}"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.t3.medium"
  allocated_storage    = 100
  storage_encrypted    = true
  db_name              = "brandos"
  username             = "brandos"
  password             = var.db_password
  skip_final_snapshot  = false
  multi_az             = true

  tags = {
    Environment = var.environment
    Project     = "brand-os"
  }
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_password) >= 16 && can(regex("[A-Z]", var.db_password)) && can(regex("[a-z]", var.db_password)) && can(regex("[0-9]", var.db_password))
    error_message = "db_password must be at least 16 characters and contain uppercase, lowercase, and numeric characters."
  }
}

################################################################################
# ElastiCache Redis
################################################################################
resource "aws_elasticache_replication_group" "brand_os" {
  replication_group_id = "brand-os-${var.environment}"
  description          = "Brand OS Redis cluster"
  node_type            = "cache.t3.medium"
  num_cache_clusters   = 2
  engine_version       = "7.0"
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = {
    Environment = var.environment
    Project     = "brand-os"
  }
}
