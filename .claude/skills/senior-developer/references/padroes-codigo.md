# Padrões de Código

## Padrões GoF mais úteis no dia a dia

### Strategy — troca de algoritmo em runtime
```typescript
// ❌ Sem Strategy
function calculateShipping(method: string, weight: number) {
  if (method === 'express') return weight * 15
  if (method === 'standard') return weight * 5
  if (method === 'economy') return weight * 2
}

// ✅ Com Strategy
interface ShippingStrategy {
  calculate(weight: number): number
}

class ExpressShipping implements ShippingStrategy {
  calculate(weight: number) { return weight * 15 }
}

class StandardShipping implements ShippingStrategy {
  calculate(weight: number) { return weight * 5 }
}

class ShippingCalculator {
  constructor(private strategy: ShippingStrategy) {}
  calculate(weight: number) { return this.strategy.calculate(weight) }
}
```

### Repository — abstrai acesso a dados
```typescript
interface UserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  save(user: User): Promise<User>
  delete(id: string): Promise<void>
}

// Implementação real
class PrismaUserRepository implements UserRepository { ... }

// Implementação para testes
class InMemoryUserRepository implements UserRepository { ... }
```

### Factory Method — cria objetos sem expor lógica
```typescript
class UserFactory {
  static create(dto: CreateUserDto): User {
    return new User({
      id: crypto.randomUUID(),
      ...dto,
      createdAt: new Date(),
      status: 'active'
    })
  }

  static createAdmin(dto: CreateUserDto): User {
    return new User({ ...this.create(dto), role: 'admin' })
  }
}
```

### Observer — notifica múltiplos ouvintes
```typescript
// Prefira eventos de domínio ao Observer manual
class OrderCreated {
  constructor(public readonly orderId: string, public readonly total: number) {}
}

// EventEmitter, EventBus, ou bibliotecas como eventemitter3
eventBus.emit('OrderCreated', new OrderCreated(order.id, order.total))
eventBus.on('OrderCreated', sendConfirmationEmail)
eventBus.on('OrderCreated', updateInventory)
eventBus.on('OrderCreated', notifyWarehouse)
```

### Decorator — adiciona comportamento sem alterar a classe
```typescript
// TypeScript decorators ou composição manual
function withLogging<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: Parameters<T>) => {
    console.log(`Calling ${fn.name} with`, args)
    const result = fn(...args)
    console.log(`${fn.name} returned`, result)
    return result
  }) as T
}
```

---

## Programação Funcional — técnicas úteis

### Guard Clauses (Early Return)
```typescript
// ❌ Nested hell
function processOrder(order: Order) {
  if (order) {
    if (order.items.length > 0) {
      if (order.customer.isActive) {
        // lógica principal aqui
      }
    }
  }
}

// ✅ Guard clauses
function processOrder(order: Order) {
  if (!order) throw new InvalidOrderError('Order is required')
  if (order.items.length === 0) throw new InvalidOrderError('Order must have items')
  if (!order.customer.isActive) throw new InactiveCustomerError()

  // lógica principal sem aninhamento
}
```

### Pipe / Compose
```typescript
// Encadeamento de transformações
const processUser = pipe(
  validateEmail,
  normalizePhone,
  hashPassword,
  enrichWithDefaults,
)

const result = processUser(rawUserData)
```

### Imutabilidade
```typescript
// ❌ Mutação
function addItem(cart: Cart, item: Item) {
  cart.items.push(item)  // modifica o original
  cart.total += item.price
  return cart
}

// ✅ Imutável
function addItem(cart: Cart, item: Item): Cart {
  return {
    ...cart,
    items: [...cart.items, item],
    total: cart.total + item.price
  }
}
```

---

## Padrões de Nomenclatura

### Funções e métodos
```
// Verbos claros que comunicam intenção
getUserById()       ✅   getUser()          ❌ (get o quê?)
calculateTotal()    ✅   doCalculation()    ❌
sendWelcomeEmail()  ✅   handleEmail()      ❌
isEligibleForDiscount() ✅  checkDiscount() ❌
```

### Variáveis booleanas
```
isActive, hasPermission, canEdit, shouldRetry, wasProcessed
❌ active, permission, edit, retry, processed (ambíguos)
```

### Coleções
```
users, orders, items    ✅  (plural claro)
userList, orderArray    ❌  (redundante)
data, info, stuff       ❌  (sem significado)
```

---

## Complexidade Ciclomática

Métrica que conta caminhos independentes no código.
Cada `if`, `else`, `for`, `while`, `catch`, `case` adiciona 1.

| Complexidade | Risco | Ação |
|-------------|-------|------|
| 1-5 | Baixo | OK |
| 6-10 | Médio | Considere refatorar |
| 11-20 | Alto | Refatore |
| 21+ | Crítico | Refatore urgente |

Funções com complexidade alta são difíceis de testar — e geralmente têm bugs escondidos.
