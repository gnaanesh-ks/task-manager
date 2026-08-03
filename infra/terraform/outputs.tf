output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  description = "Endpoint for the EKS control plane"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data for the cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}

output "cluster_oidc_issuer_url" {
  description = "OIDC issuer URL for IRSA"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "node_group_role_arn" {
  description = "IAM role ARN used by worker nodes"
  value       = aws_iam_role.eks_node_role.arn
}

output "alb_controller_role_arn" {
  description = "IAM role ARN for the AWS Load Balancer Controller service account (IRSA)"
  value       = aws_iam_role.alb_controller.arn
}

output "configure_kubectl" {
  description = "Command to update local kubeconfig for this cluster"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${aws_eks_cluster.main.name}"
}
