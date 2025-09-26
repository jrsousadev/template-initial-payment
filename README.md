# Payment Gateway API - Status do Projeto

### TO DO

- [ ] Realizar testes de envio de webhook (Lambda, SQS);

### Segurança

- [ ] Habilitar funcionalidade de 2FA;
- [ ] Criptografia de dados sensíveis (2FA, senhas, tokens, etc.)

### Autenticação e Autorização

- [ ] Autenticação (Master, Admin)
- [ ] Resetar senha;
- [ ] Rota de linkar usuário na empresa

### Monitoramento e Logs

- [ ] Criar um monitoramento de pagamentos/infrações/saques com error_system status
- [ ] Monitoramento de logs (com mongoose)

### DevOps

- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Docker multi-stage build
- [ ] Kubernetes manifests
- [ ] Terraform para infraestrutura

### Front-end

- [ ] Modulo dashboard para alimentar front-end (Dashboard User, Admin e Master)

### Não urgentes

- [ ] Pensar em saques externos (sem receiver)
- [ ] Aplicar lógica dos splits (Estudar lógica e também aplicação de infrações: pensar em transactions)
- [ ] Ver se alguma tabela faltou indexar (se faltou criar outra tarefa para indexar)
- [ ] Cachear includes pesados (Estudar melhor estratégia)
