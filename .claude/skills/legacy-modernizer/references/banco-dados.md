# Migração de Banco de Dados

## Princípios de Migração Segura

1. **Nunca migre dados em produção sem dry-run antes**
2. **Sempre tenha plano de rollback antes de executar**
3. **Backup antes de qualquer migração destrutiva**
4. **Prefira migrações aditivas (ADD) antes de destrutivas (DROP)**
5. **Monitore performance durante e após a migração**

---

## Estratégias por Cenário

### Cenário 1 — Mesmo banco, schema antigo → novo

Use migrations versionadas com ferramentas como:
- Flyway, Liquibase (Java)
- Alembic (Python)
- Prisma Migrate, Knex (Node.js)
- Rails Migrations (Ruby)

```sql
-- V1__initial_schema.sql (já existia)
-- V2__add_status_v2.sql (expand)
ALTER TABLE orders ADD COLUMN status_v2 VARCHAR(20);

-- V3__migrate_status_data.sql
UPDATE orders SET status_v2 = CASE stat_cd
  WHEN 1 THEN 'pending'
  WHEN 2 THEN 'processing'
  WHEN 3 THEN 'completed'
  ELSE 'unknown'
END;
ALTER TABLE orders ALTER COLUMN status_v2 SET NOT NULL;

-- V4__drop_old_status.sql (contract — só após deploy validado)
ALTER TABLE orders DROP COLUMN stat_cd;
```

### Cenário 2 — Banco diferente (ex: MySQL → PostgreSQL)

```
Processo recomendado:
1. Análise de compatibilidade de tipos de dados
2. Export schema do MySQL → adapte para PostgreSQL
3. Export dados em CSV ou usando pgloader
4. Execute migração em ambiente de staging
5. Valide contagem de registros e integridade
6. Execute em produção com janela de manutenção mínima
7. Mantenha MySQL em read-only por período de validação
```

```bash
# pgloader — migração automática MySQL → PostgreSQL
pgloader mysql://user:pass@host/legacy_db \
          postgresql://user:pass@host/new_db

# Valide após migração
psql -c "SELECT COUNT(*) FROM orders;" new_db
mysql -e "SELECT COUNT(*) FROM orders;" legacy_db
# Os números devem ser iguais
```

### Cenário 3 — Banco relacional → NoSQL (ou vice-versa)

Alta complexidade. Use sempre migração gradual:

```
1. Sincronização dupla: escreva nos dois bancos simultaneamente
   - Writes vão para Relacional E NoSQL
   - Reads ainda vêm do Relacional

2. Validação: compare resultados de queries equivalentes

3. Shadow reads: para % do tráfego, leia do NoSQL e compare

4. Migração de reads: quando confiante, redirecione reads para NoSQL

5. Descomissionamento: pare de escrever no banco antigo
```

---

## Migrações de Grande Volume

Para tabelas com milhões de registros, migrações em batch:

```python
# Migração em lotes para evitar lock de tabela e timeout
def migrate_orders_in_batches():
    batch_size = 1000
    last_id = 0

    while True:
        # Busca lote
        orders = db.query("""
            SELECT id, stat_cd FROM orders
            WHERE id > %s AND status_v2 IS NULL
            ORDER BY id
            LIMIT %s
        """, (last_id, batch_size))

        if not orders:
            break

        # Processa lote
        for order in orders:
            new_status = map_status(order['stat_cd'])
            db.execute("UPDATE orders SET status_v2 = %s WHERE id = %s",
                      (new_status, order['id']))

        last_id = orders[-1]['id']
        db.commit()

        # Pausa para não sobrecarregar o banco
        time.sleep(0.1)
        print(f"Migrated up to id {last_id}")
```

---

## Checklist de Migração de Banco

**Antes:**
- [ ] Backup completo executado e verificado
- [ ] Dry-run em staging com dados reais (anonimizados)
- [ ] Contagem de registros documentada (para validação pós-migração)
- [ ] Plano de rollback testado
- [ ] Monitoramento de performance configurado
- [ ] Janela de manutenção comunicada (se necessária)

**Durante:**
- [ ] Acompanhar locks e queries lentas
- [ ] Monitorar CPU, I/O e conexões do banco
- [ ] Log de progresso para batches longos

**Após:**
- [ ] Validar contagem de registros em todas as tabelas críticas
- [ ] Executar smoke tests funcionais
- [ ] Verificar performance de queries críticas
- [ ] Monitorar por pelo menos 24h antes de remover estruturas antigas
