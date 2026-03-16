################################################################################
# EKS Cluster
################################################################################
resource "aws_eks_cluster" "brand_os" {
  name     = var.cluster_name
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.29"

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.eks_cluster.id]
  }

  tags = {
    Environment = var.environment
    Project     = "brand-os"
  }
}

resource "aws_security_group" "eks_cluster" {
  name        = "brand-os-eks-cluster-${var.environment}"
  description = "EKS cluster control plane security group"
  vpc_id      = aws_vpc.brand_os.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "brand-os-eks-cluster-sg"
    Environment = var.environment
  }
}

resource "aws_security_group" "eks_nodes" {
  name        = "brand-os-eks-nodes-${var.environment}"
  description = "EKS worker node security group"
  vpc_id      = aws_vpc.brand_os.id

  ingress {
    description = "Allow nodes to communicate with each other"
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    self        = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "brand-os-eks-nodes-sg"
    Environment = var.environment
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

resource "aws_db_subnet_group" "brand_os" {
  name       = "brand-os-${var.environment}"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Environment = var.environment
    Project     = "brand-os"
  }
}

resource "aws_security_group" "rds" {
  name        = "brand-os-rds-${var.environment}"
  description = "Allow PostgreSQL access from EKS nodes"
  vpc_id      = aws_vpc.brand_os.id

  ingress {
    description     = "PostgreSQL from EKS nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "brand-os-rds-sg"
    Environment = var.environment
  }
}

resource "aws_db_instance" "brand_os" {
  identifier             = "brand-os-${var.environment}"
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = "db.t3.medium"
  allocated_storage      = 100
  storage_encrypted      = true
  db_name                = "brandos"
  username               = "brandos"
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.brand_os.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  skip_final_snapshot    = false
  multi_az               = true

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

resource "aws_elasticache_subnet_group" "brand_os" {
  name       = "brand-os-${var.environment}"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Environment = var.environment
    Project     = "brand-os"
  }
}

resource "aws_security_group" "redis" {
  name        = "brand-os-redis-${var.environment}"
  description = "Allow Redis access from EKS nodes"
  vpc_id      = aws_vpc.brand_os.id

  ingress {
    description     = "Redis from EKS nodes"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "brand-os-redis-sg"
    Environment = var.environment
  }
}

resource "aws_elasticache_replication_group" "brand_os" {
  replication_group_id       = "brand-os-${var.environment}"
  description                = "Brand OS Redis cluster"
  node_type                  = "cache.t3.medium"
  num_cache_clusters         = 2
  engine_version             = "7.0"
  subnet_group_name          = aws_elasticache_subnet_group.brand_os.name
  security_group_ids         = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = {
    Environment = var.environment
    Project     = "brand-os"
  }
}
