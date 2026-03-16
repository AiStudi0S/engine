################################################################################
# Terraform Outputs
################################################################################

output "eks_cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = aws_eks_cluster.brand_os.endpoint
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.brand_os.name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.brand_os.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = aws_elasticache_replication_group.brand_os.primary_endpoint_address
  sensitive   = true
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.brand_os.id
}
