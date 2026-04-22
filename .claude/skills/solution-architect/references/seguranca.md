# Checklist de Segurança para Arquitetos

## Autenticação e Autorização

- [ ] Autenticação via OAuth2 / OpenID Connect ou JWT com rotação de chaves
- [ ] Tokens com expiração curta (access token: 15min, refresh token: 7-30 dias)
- [ ] Autorização baseada em roles (RBAC) ou atributos (ABAC)
- [ ] MFA para usuários administrativos
- [ ] Bloqueio após tentativas falhas (brute force protection)
- [ ] Nunca armazene senhas em texto plano — use bcrypt, argon2 ou scrypt

## Transporte e Criptografia

- [ ] TLS 1.2+ em todas as comunicações externas
- [ ] TLS mútuo (mTLS) para comunicação entre microsserviços críticos
- [ ] Certificados gerenciados com renovação automática (Let's Encrypt, ACM)
- [ ] Dados sensíveis criptografados em repouso (AES-256)
- [ ] Chaves armazenadas em serviço dedicado (AWS KMS, HashiCorp Vault, Azure Key Vault)

## Proteção de APIs

- [ ] Rate limiting por IP e por usuário
- [ ] Validação de input em todas as entradas (nunca confie no cliente)
- [ ] Proteção contra SQL Injection (use prepared statements / ORM)
- [ ] Proteção contra XSS (sanitização de saída, CSP headers)
- [ ] Proteção contra CSRF (tokens anti-CSRF ou SameSite cookies)
- [ ] Headers de segurança: `X-Frame-Options`, `X-Content-Type-Options`, `HSTS`

## Gestão de Segredos

- [ ] Nunca commit de secrets no repositório (use .gitignore + git-secrets)
- [ ] Use variáveis de ambiente ou secret manager (AWS Secrets Manager, Vault)
- [ ] Rotação periódica de credenciais e API keys
- [ ] Princípio do menor privilégio — cada serviço acessa só o que precisa

## Infraestrutura

- [ ] Firewall / Security Groups — portas abertas apenas ao necessário
- [ ] Banco de dados nunca exposto diretamente à internet
- [ ] VPC / rede privada para comunicação interna
- [ ] WAF (Web Application Firewall) para APIs públicas
- [ ] DDoS protection (CloudFlare, AWS Shield)
- [ ] Patch management — sistemas operacionais e dependências atualizados

## Auditoria e Monitoramento

- [ ] Logs de autenticação (login, logout, falhas)
- [ ] Logs de acesso a dados sensíveis
- [ ] Alertas para comportamentos anômalos (muitos erros 401, volume incomum de dados)
- [ ] Retenção de logs por período adequado (LGPD, compliance)
- [ ] Plano de resposta a incidentes documentado

## LGPD / Privacidade

- [ ] Mapeamento de dados pessoais armazenados
- [ ] Base legal para cada tratamento de dados definida
- [ ] Mecanismo de exclusão de dados (direito ao esquecimento)
- [ ] Consentimento registrado e rastreável
- [ ] Anonimização ou pseudonimização de dados em ambientes não-produtivos
- [ ] DPO (Encarregado) definido e canal de contato publicado

## OWASP Top 10 — Referência Rápida

| # | Risco | Como mitigar |
|---|-------|-------------|
| A01 | Broken Access Control | RBAC, testes de autorização |
| A02 | Cryptographic Failures | TLS, criptografia em repouso |
| A03 | Injection | Prepared statements, validação de input |
| A04 | Insecure Design | Threat modeling, design seguro desde o início |
| A05 | Security Misconfiguration | IaC, revisão de configurações, headers |
| A06 | Vulnerable Components | Dependabot, SBOM, atualizações frequentes |
| A07 | Auth Failures | MFA, bloqueio de brute force, tokens curtos |
| A08 | Integrity Failures | Assinatura de pacotes, CI/CD seguro |
| A09 | Logging Failures | Logs estruturados, alertas, retenção |
| A10 | SSRF | Validação de URLs, allowlist de destinos |
