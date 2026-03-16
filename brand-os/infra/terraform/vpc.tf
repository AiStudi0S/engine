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

resource "aws_internet_gateway" "brand_os" {
  vpc_id = aws_vpc.brand_os.id

  tags = {
    Name        = "brand-os-igw"
    Environment = var.environment
  }
}
