################################################################################
# VPC
################################################################################
resource "aws_vpc" "brand_os" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "brand-os-${var.environment}"
    Environment = var.environment
    Project     = "brand-os"
  }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.brand_os.id
  cidr_block        = "10.0.${count.index}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "brand-os-private-${count.index}"
    Environment = var.environment
  }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.brand_os.id
  cidr_block              = "10.0.${count.index + 10}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "brand-os-public-${count.index}"
    Environment = var.environment
  }
}

data "aws_availability_zones" "available" {}

################################################################################
# Internet Gateway
################################################################################
resource "aws_internet_gateway" "brand_os" {
  vpc_id = aws_vpc.brand_os.id

  tags = {
    Name        = "brand-os-igw"
    Environment = var.environment
  }
}

################################################################################
# NAT Gateway (one per AZ for HA; use count = 1 for cost-optimised dev)
################################################################################
resource "aws_eip" "nat" {
  count  = var.nat_gateway_count
  domain = "vpc"

  tags = {
    Name        = "brand-os-nat-eip-${count.index}"
    Environment = var.environment
  }
}

resource "aws_nat_gateway" "brand_os" {
  count         = var.nat_gateway_count
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name        = "brand-os-nat-${count.index}"
    Environment = var.environment
  }

  depends_on = [aws_internet_gateway.brand_os]
}

################################################################################
# Route Tables
################################################################################

# Public subnets → Internet Gateway
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.brand_os.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.brand_os.id
  }

  tags = {
    Name        = "brand-os-public-rt"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private subnets → NAT Gateway (one route table per AZ for HA)
resource "aws_route_table" "private" {
  count  = length(aws_subnet.private)
  vpc_id = aws_vpc.brand_os.id

  route {
    cidr_block     = "0.0.0.0/0"
    # Route each private subnet through its corresponding NAT gateway
    # (falls back to NAT[0] when nat_gateway_count = 1)
    nat_gateway_id = aws_nat_gateway.brand_os[min(count.index, var.nat_gateway_count - 1)].id
  }

  tags = {
    Name        = "brand-os-private-rt-${count.index}"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}
