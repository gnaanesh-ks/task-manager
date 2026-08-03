# TaskFlow — Execution Master Guide

End-to-end guide to run this 3-tier microservices app locally, then ship it to
production on AWS EKS via ECR + Terraform + ArgoCD, with Prometheus/Grafana
observability.

Repository layout:

```
task-manager/
├── frontend/                 # HTML5 + CSS3 + vanilla JS, Nginx multi-stage Dockerfile
├── services/
│   ├── auth-service/          # Node/Express JWT auth (signup/login/verify)
│   └── task-service/          # Node/Express task CRUD (JWT-protected)
├── infra/
│   ├── terraform/              # VPC + EKS cluster + managed node group
│   ├── k8s/                    # Deployments/Services/ConfigMaps/Secrets/Ingress
│   ├── argocd/                 # ArgoCD Application + AppProject
│   └── observability/          # kube-prometheus-stack values + Grafana dashboard
├── docker-compose.yml         # Local dev stack
└── docs/EXECUTION_GUIDE.md    # This file
```

---

## Phase 0 — Local Verification (docker-compose)

Before touching AWS, prove the three tiers work together locally.

```bash
cd task-manager
docker compose build
docker compose up -d
docker compose logs -f auth-service task-service
```

Test the flow with curl:

```bash
# Signup
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","password":"secret123"}'

# Login (copy the returned token)
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret123"}' | jq -r .token)

# Create a task
curl -X POST http://localhost:4001/api/tasks/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Ship the EKS cluster","priority":"high"}'

# List tasks
curl http://localhost:4001/api/tasks/ -H "Authorization: Bearer $TOKEN"
```

Open `http://localhost:8080` for the UI (it proxies `/api/auth` and `/api/tasks`
through the Nginx config to the two backend containers on the docker-compose
network).

---

## Phase 1 — Provision AWS Infrastructure (Terraform)

**Prerequisites:** AWS CLI configured (`aws configure`), Terraform >= 1.6,
an S3 bucket + DynamoDB table for remote state (recommended), IAM permissions
for EKS/EC2/VPC/IAM.

```bash
cd infra/terraform

# 1. Configure remote state (edit providers.tf backend block first), then:
terraform init

# 2. Copy and edit variables
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars: region, cluster_name, node sizing, etc.

# 3. Review the plan
terraform plan -var-file=terraform.tfvars -out=tfplan

# 4. Apply
terraform apply tfplan
```

This provisions:
- A VPC with 3 public + 3 private subnets across 3 AZs, an Internet Gateway,
  3 NAT Gateways (one per AZ for HA), and correct route tables.
- An EKS control plane (`aws_eks_cluster.main`) on the specified Kubernetes
  version, with both private and public endpoint access enabled.
- An OIDC provider for the cluster (required later for IRSA, e.g. the AWS
  Load Balancer Controller or Prometheus/Grafana IAM-bound service accounts).
- A managed node group (`aws_eks_node_group.main`) running in the private
  subnets, auto-scaling between `node_min_size` and `node_max_size`.
- EKS add-ons: `vpc-cni`, `kube-proxy`, `coredns`, `aws-ebs-csi-driver` (the
  last one is required for the MongoDB and Prometheus PersistentVolumeClaims).

Once applied, connect `kubectl`:

```bash
terraform output configure_kubectl
# copy/paste the printed command, e.g.:
aws eks update-kubeconfig --region us-east-1 --name task-manager-eks

kubectl get nodes
```

> **AWS Load Balancer Controller**: the `ingress.yaml` manifest uses
> `kubernetes.io/ingress.class: alb`, which requires the AWS Load Balancer
> Controller installed on the cluster. Install it via Helm once the cluster
> is up:
> ```bash
> helm repo add eks https://aws.github.io/eks-charts
> helm repo update
> helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
>   -n kube-system \
>   --set clusterName=task-manager-eks \
>   --set serviceAccount.create=true
> ```
> (This requires an IAM policy + IRSA role bound to the controller's service
> account — see the AWS documentation for the exact IAM policy JSON, as it is
> maintained by AWS and updated periodically.)

---

## Phase 2 — Build & Push Images to AWS ECR

```bash
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1

# 1. Create ECR repositories (one per service)
aws ecr create-repository --repository-name task-manager/frontend --region $AWS_REGION
aws ecr create-repository --repository-name task-manager/auth-service --region $AWS_REGION
aws ecr create-repository --repository-name task-manager/task-service --region $AWS_REGION

# 2. Authenticate Docker to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# 3. Build images
docker build -t task-manager/frontend:latest ./frontend
docker build -t task-manager/auth-service:latest ./services/auth-service
docker build -t task-manager/task-service:latest ./services/task-service

# 4. Tag for ECR
docker tag task-manager/frontend:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/task-manager/frontend:latest
docker tag task-manager/auth-service:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/task-manager/auth-service:latest
docker tag task-manager/task-service:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/task-manager/task-service:latest

# 5. Push
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/task-manager/frontend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/task-manager/auth-service:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/task-manager/task-service:latest
```

Then replace the `<AWS_ACCOUNT_ID>` and `<AWS_REGION>` placeholders inside
`infra/k8s/*/deployment.yaml` with your real values (or template them with
`envsubst`/Kustomize/Helm in a real pipeline — see Phase 4 note).

```bash
find infra/k8s -name "deployment.yaml" -exec \
  sed -i "s/<AWS_ACCOUNT_ID>/$AWS_ACCOUNT_ID/g; s/<AWS_REGION>/$AWS_REGION/g" {} \;
```

For subsequent releases, tag images with your commit SHA or a semantic
version instead of `latest` (e.g. `:git-$(git rev-parse --short HEAD)`) and
update the corresponding `deployment.yaml` image tag — this is what your CI
pipeline should automate and commit back to the GitOps repo so ArgoCD picks
it up.

---

## Phase 3 — Secrets

Before applying manifests, replace every placeholder secret value:

- `infra/k8s/mongodb/secret.yaml` → `MONGO_INITDB_ROOT_PASSWORD`
- `infra/k8s/auth-service/secret.yaml` → `JWT_SECRET`, `MONGO_URI` (password must match Mongo's)
- `infra/k8s/task-service/secret.yaml` → `JWT_SECRET` (**must be identical** to auth-service's), `MONGO_URI`

Generate a strong JWT secret:

```bash
openssl rand -base64 48
```

In a real production setup, use **AWS Secrets Manager + External Secrets
Operator** (or Sealed Secrets) instead of committing plaintext Secret
manifests to Git — the plain `Secret` YAMLs here are provided for clarity and
should be treated as templates, not committed with real values.

---

## Phase 4 — GitOps Repository & ArgoCD

1. Push the contents of this project (or at minimum `infra/k8s/`) to a Git
   repository, e.g. `github.com/<your-org>/task-manager-gitops`.
2. Update `infra/argocd/application.yaml` and `project.yaml`:
   `repoURL: https://github.com/<YOUR_GITHUB_ORG>/task-manager-gitops.git`
3. Install ArgoCD on the cluster:

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for pods
kubectl get pods -n argocd -w
```

4. Access the ArgoCD UI:

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
# https://localhost:8080

# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

5. Apply the AppProject and Application:

```bash
kubectl apply -f infra/argocd/project.yaml
kubectl apply -f infra/argocd/application.yaml
```

ArgoCD will:
- Create the `task-manager` namespace (`CreateNamespace=true`)
- Sync every manifest under `infra/k8s/` (namespace, Mongo, auth-service,
  task-service, frontend, ingress)
- Continuously reconcile (`automated.selfHeal: true`) — any manual `kubectl edit`
  drift is reverted back to what's in Git, and any new commit to `main` in the
  GitOps repo is auto-applied (`automated.prune/self-heal`).

Verify sync status:

```bash
kubectl get applications -n argocd
kubectl describe application task-manager -n argocd
```

Or via the ArgoCD CLI:

```bash
argocd app get task-manager
argocd app sync task-manager
```

---

## Phase 5 — Verify the Deployment

```bash
kubectl get all -n task-manager

# Check pod health
kubectl get pods -n task-manager -o wide
kubectl logs -n task-manager deploy/auth-service
kubectl logs -n task-manager deploy/task-service

# Get the ALB hostname created by the Ingress
kubectl get ingress -n task-manager
```

Once the ALB's `ADDRESS` resolves (may take 2-3 minutes), open it in a
browser to load the frontend, then repeat the signup/login/task-create flow
from Phase 0 against the live ALB hostname instead of `localhost`.

Rolling update check (test that ArgoCD + K8s handle a new image gracefully):

```bash
# after pushing a new image tag and committing the updated deployment.yaml
kubectl rollout status deployment/task-service -n task-manager
```

---

## Phase 6 — Observability (Prometheus, Grafana, Node Exporter)

Install the `kube-prometheus-stack` Helm chart, which bundles Prometheus,
Alertmanager, Grafana, node-exporter (as a DaemonSet), and kube-state-metrics:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

kubectl create namespace monitoring

# Copy the dashboard JSON so Helm can mount it as a ConfigMap-backed dashboard
kubectl create configmap grafana-dashboard-cluster-node \
  --from-file=infra/observability/dashboards/grafana-cluster-node-dashboard.json \
  -n monitoring

helm install kube-prom-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  -f infra/observability/prometheus-values.yaml
```

Verify node-exporter is running as a DaemonSet on every node:

```bash
kubectl get daemonset -n monitoring
kubectl get pods -n monitoring -l app.kubernetes.io/name=node-exporter -o wide
```

Access Grafana:

```bash
kubectl port-forward svc/kube-prom-stack-grafana -n monitoring 3000:80
# http://localhost:3000  (user: admin, password: value set in prometheus-values.yaml)
```

The "Task Manager - Cluster & Node Metrics" dashboard
(`infra/observability/dashboards/grafana-cluster-node-dashboard.json`) is
auto-provisioned via the `dashboards:` block in `prometheus-values.yaml` and
appears under the **Task Manager** folder. It tracks:
- Cluster-wide CPU and memory utilization (from `node_cpu_seconds_total` /
  `node_memory_MemAvailable_bytes`)
- Per-node disk usage and network I/O
- Pods running per node, node load average
- Kubelet/node-exporter target health, and pod restart counts scoped to the
  `task-manager` namespace

For production, expose Grafana behind the same ALB Ingress (path
`/grafana`) with proper authentication (OIDC/SSO) rather than only
port-forwarding.

---

## Phase 7 — Day-2 Operations Cheat Sheet

| Task | Command |
|---|---|
| Scale a service | `kubectl scale deployment/task-service -n task-manager --replicas=4` (or edit Git + let ArgoCD reconcile) |
| Roll back a bad release | `argocd app rollback task-manager <REVISION>` |
| Force re-sync from Git | `argocd app sync task-manager --force` |
| Tail logs across all auth pods | `kubectl logs -n task-manager -l app=auth-service -f --max-log-requests=10` |
| Check node group scaling | `aws eks describe-nodegroup --cluster-name task-manager-eks --nodegroup-name task-manager-eks-ng-default` |
| Destroy everything (careful) | `terraform destroy` in `infra/terraform` (after deleting K8s LoadBalancer-backed resources first, so ELBs don't dangle) |

---

## Security Hardening Notes (Read Before Production Use)

1. Replace every `CHANGE_ME_*` value in the Secret manifests — do not
   deploy with the placeholders in this guide.
2. Move Secrets to AWS Secrets Manager + External Secrets Operator instead
   of plaintext-in-Git `Secret` manifests.
3. Restrict the EKS API server's public endpoint (`endpoint_public_access`)
   to known CIDRs, or disable it entirely and rely on a bastion / VPN for
   private-only access.
4. Add NetworkPolicies so `task-service`/`auth-service` can only be reached
   from the `frontend`/Ingress, and `mongodb` only from the two backend
   services.
5. Enable MongoDB authentication (already configured) and consider
   Amazon DocumentDB or a managed MongoDB Atlas cluster for production
   instead of a single, non-replicated in-cluster MongoDB pod.
6. Rotate the JWT secret periodically and consider short-lived access
   tokens + refresh tokens instead of a single 1-day JWT.
