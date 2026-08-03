# TaskFlow — 3-Tier Microservices Task Manager

A production-ready reference implementation of a 3-tier microservices
architecture: a vanilla HTML/CSS/JS frontend, two Node.js/Express
microservices (Auth + Tasks) backed by MongoDB, containerized, deployed to
AWS EKS via Terraform + ArgoCD (GitOps), and monitored with
Prometheus/Grafana/node-exporter.

See **[`docs/EXECUTION_GUIDE.md`](docs/EXECUTION_GUIDE.md)** for the complete,
step-by-step build → push → deploy → verify → monitor walkthrough.

## Quick start (local)

```bash
docker compose up --build
# Frontend:      http://localhost:8080
# Auth Service:  http://localhost:4000/healthz
# Task Service:  http://localhost:4001/healthz
```

## Project layout

```
frontend/            Static HTML5/CSS3/vanilla JS + Nginx multi-stage Dockerfile
services/auth-service/  Node/Express — signup, login, JWT verify
services/task-service/  Node/Express — task CRUD, JWT-protected
infra/terraform/      VPC + EKS + managed node group
infra/k8s/            Deployments/Services/ConfigMaps/Secrets/Ingress per component
infra/argocd/         ArgoCD Application + AppProject (GitOps entry point)
infra/observability/  kube-prometheus-stack Helm values + Grafana dashboard JSON
docs/                 Execution Master Guide
```
