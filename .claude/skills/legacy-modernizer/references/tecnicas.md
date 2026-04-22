# Técnicas de Modernização

## Testes de Caracterização (Golden Master)

Use quando não há testes e você precisa refatorar com segurança.
A ideia: capture o comportamento atual como "verdade", mesmo que incorreto.

```python
# 1. Execute o código legado com inputs reais e salve os outputs
def test_characterization_calculate_tax():
    # Chame a função legada e capture o resultado
    result = legacy_calculate_tax(income=50000, state="SP")
    # Congele esse resultado como expectativa
    assert result == 7823.45  # valor atual, certo ou errado

# 2. Agora refatore com segurança
# Se o teste quebrar, você mudou o comportamento — intencional ou não?
```

**Atenção:** testes de caracterização capturam bugs também. Ao encontrar um bug,
decida conscientemente: corrigir (e atualizar o teste) ou preservar (por compatibilidade).

---

## Branch by Abstraction

Técnica para substituir um componente sem criar uma branch de longa duração no Git.

```
Passo 1: Crie uma abstração (interface) em volta do componente legado
Passo 2: Faça o código existente usar a abstração (não o componente diretamente)
Passo 3: Implemente o novo componente atrás da mesma abstração
Passo 4: Alterne entre legado e novo via feature flag
Passo 5: Quando o novo estiver validado, remova o legado e a abstração

Exemplo:
```

```typescript
// Passo 1-2: abstração
interface PaymentGateway {
  charge(amount: number, card: CardData): Promise<PaymentResult>
}

// Implementação legada (existente)
class LegacyPaymentGateway implements PaymentGateway { ... }

// Passo 3: nova implementação
class StripeGateway implements PaymentGateway { ... }

// Passo 4: feature flag decide qual usar
class PaymentGatewayFactory {
  static create(): PaymentGateway {
    return featureFlags.isEnabled('new-payment-gateway')
      ? new StripeGateway()
      : new LegacyPaymentGateway()
  }
}
```

---

## Parallel Run (Execução em Paralelo)

Execute legado e novo sistema simultaneamente, compare resultados.
Use para validar equivalência antes de desligar o legado.

```typescript
async function calculateShippingWithParallelRun(order: Order) {
  // Executa os dois em paralelo
  const [legacyResult, newResult] = await Promise.all([
    legacyShippingService.calculate(order),
    newShippingService.calculate(order)
  ])

  // Loga divergências para análise (não bloqueia o usuário)
  if (legacyResult.total !== newResult.total) {
    logger.warn('Shipping calculation divergence', {
      orderId: order.id,
      legacy: legacyResult.total,
      new: newResult.total,
      diff: newResult.total - legacyResult.total
    })
    metrics.increment('shipping.divergence')
  }

  // Por enquanto, retorna o resultado legado (mais seguro)
  return legacyResult

  // Quando confiante, troque para: return newResult
}
```

---

## Expand-Contract Pattern (para mudanças de API/Schema)

Para mudar um contrato sem quebrar clientes existentes.

```
EXPAND: adicione o novo campo/endpoint sem remover o antigo
  - API: adicione /v2/orders mantendo /v1/orders
  - Banco: adicione coluna nova sem remover a antiga

MIGRAR: atualize os clientes um a um para usar o novo contrato

CONTRACT: quando todos migraram, remova o contrato antigo
  - API: desative /v1/orders
  - Banco: remova a coluna antiga
```

```sql
-- EXPAND: adiciona coluna nova com valor default
ALTER TABLE orders ADD COLUMN status_v2 VARCHAR(20) DEFAULT 'pending';

-- MIGRAR: popula a nova coluna gradualmente
UPDATE orders SET status_v2 = CASE
  WHEN status = 1 THEN 'pending'
  WHEN status = 2 THEN 'processing'
  WHEN status = 3 THEN 'completed'
END;

-- CONTRACT: remove coluna antiga (só após todos os clientes migrarem)
ALTER TABLE orders DROP COLUMN status;
ALTER TABLE orders RENAME COLUMN status_v2 TO status;
```

---

## Técnica do Seam (Costura)

Encontre pontos no código legado onde você pode "inserir" comportamento novo
sem alterar o código original.

```php
// Código legado — não toque nele diretamente
class OrderProcessor {
    function process($order) {
        // ... 500 linhas de lógica entrelaçada
        $this->sendEmail($order);  // ← SEAM: ponto de extensão
        // ...
    }

    protected function sendEmail($order) {  // ← extraído para método protegido
        mail($order['email'], 'Pedido confirmado', '...');
    }
}

// Subclasse que substitui apenas o comportamento problemático
class ModernOrderProcessor extends OrderProcessor {
    protected function sendEmail($order) {
        $this->emailService->sendOrderConfirmation($order);  // novo serviço
    }
}
```

---

## Anti-Corruption Layer (ACL)

Crie uma camada de tradução entre o sistema legado e o novo,
para que o novo sistema não precise falar a "língua feia" do legado.

```typescript
// O legado retorna isso (estrutura horrível e inconsistente)
interface LegacyOrder {
  ord_id: string
  cust_nm: string
  tot_val: string        // número como string!
  stat_cd: number        // 1=pending, 2=processing, 3=done
  itm_lst: string        // JSON serializado como string!
}

// O novo sistema quer trabalhar com isso
interface Order {
  id: string
  customerName: string
  total: number
  status: 'pending' | 'processing' | 'completed'
  items: OrderItem[]
}

// Anti-Corruption Layer — traduz sem poluir o domínio novo
class LegacyOrderAdapter {
  static toDomain(legacy: LegacyOrder): Order {
    return {
      id: legacy.ord_id,
      customerName: legacy.cust_nm,
      total: parseFloat(legacy.tot_val),
      status: this.mapStatus(legacy.stat_cd),
      items: JSON.parse(legacy.itm_lst)
    }
  }

  private static mapStatus(code: number): Order['status'] {
    const map: Record<number, Order['status']> = {
      1: 'pending', 2: 'processing', 3: 'completed'
    }
    return map[code] ?? 'pending'
  }
}
```
