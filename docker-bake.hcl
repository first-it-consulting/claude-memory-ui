target "docker-metadata-action" {}

variable "VERSION" {
  default = "0.1.0"
}

# Registry prefix for the published tags. Override for other registries:
#   REGISTRY=ghcr.io/<you> docker buildx bake ...
variable "REGISTRY" {
  default = "ghcr.io/first-it-consulting"
}

# Full commit sha shown in the UI footer (git rev-parse HEAD at build time).
variable "GIT_SHA" {
  default = "unknown"
}

group "default" {
  targets = ["image-local"]
}

target "image" {
  inherits = ["docker-metadata-action"]
  args = {
    VERSION = "${VERSION}"
    GIT_SHA = "${GIT_SHA}"
  }
  tags = [
    "${REGISTRY}/claude-memory-ui:${VERSION}",
    "${REGISTRY}/claude-memory-ui:rolling",
  ]
  labels = {
    "org.opencontainers.image.source" = "https://github.com/first-it-consulting/claude-memory-ui"
  }
}

target "image-local" {
  inherits = ["image"]
  output = ["type=docker"]
}

target "image-all" {
  inherits = ["image"]
  platforms = [
    "linux/amd64",
    "linux/arm64",
  ]
  output = ["type=registry"]
}
