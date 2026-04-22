# Padrões de Testes

## Pirâmide de Testes

```
        /\
       /  \
      / E2E \          ← Poucos, lentos, caros (Cypress, Playwright)
     /────────\
    / Integração\      ← Médios, testam colaboração entre módulos
   /────────────\
  / Unitários    \     ← Muitos, rápidos, isolados
 /────────────────\
```

Proporção recomendada: 70% unitários / 20% integração / 10% E2E

---

## Doubles de Teste

| Tipo | O que é | Quando usar |
|------|---------|-------------|
| **Dummy** | Objeto passado mas não usado | Preencher parâmetros obrigatórios |
| **Stub** | Retorna valor fixo | Controlar retorno de dependências |
| **Fake** | Implementação simplificada real | Banco em memória, servidor fake |
| **Mock** | Verifica que foi chamado corretamente | Verificar interações/side effects |
| **Spy** | Registra chamadas sem substituir | Monitorar sem alterar comportamento |

**Regra:** prefira Stubs e Fakes. Use Mocks com moderação — testes com muitos mocks
testam implementação, não comportamento.

---

## JavaScript / TypeScript — Jest

```typescript
// Estrutura de arquivo de teste
// user.service.test.ts

import { UserService } from './user.service'
import { UserRepository } from './user.repository'

// Mock automático do módulo
jest.mock('./user.repository')

describe('UserService', () => {
  let userService: UserService
  let userRepository: jest.Mocked<UserRepository>

  beforeEach(() => {
    userRepository = new UserRepository() as jest.Mocked<UserRepository>
    userService = new UserService(userRepository)
  })

  describe('createUser', () => {
    it('should create user when email is unique', async () => {
      // Arrange
      const dto = { name: 'João', email: 'joao@email.com' }
      userRepository.findByEmail.mockResolvedValue(null)
      userRepository.save.mockResolvedValue({ id: '1', ...dto })

      // Act
      const result = await userService.createUser(dto)

      // Assert
      expect(result.id).toBeDefined()
      expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining(dto))
    })

    it('should throw EmailAlreadyExistsError when email is taken', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue({ id: '1', email: 'joao@email.com' })

      // Act & Assert
      await expect(userService.createUser({ name: 'João', email: 'joao@email.com' }))
        .rejects.toThrow(EmailAlreadyExistsError)
    })
  })
})
```

### Ferramentas JS/TS
| Ferramenta | Uso |
|------------|-----|
| **Jest** | Test runner + assertions + mocks |
| **Vitest** | Jest-compatível, mais rápido, para projetos Vite |
| **Testing Library** | Testes de componentes React/Vue orientados ao usuário |
| **Supertest** | Testes de integração de APIs HTTP |
| **MSW** | Mock de APIs HTTP (service worker) |
| **Playwright / Cypress** | Testes E2E |

---

## Python — pytest

```python
# test_order_service.py

import pytest
from unittest.mock import MagicMock, patch
from order_service import OrderService
from exceptions import InsufficientStockError

class TestOrderService:
    def setup_method(self):
        self.product_repo = MagicMock()
        self.order_repo = MagicMock()
        self.service = OrderService(self.product_repo, self.order_repo)

    def test_create_order_reduces_stock(self):
        # Arrange
        product = MagicMock(id='p1', stock=10, price=50.0)
        self.product_repo.find_by_id.return_value = product

        # Act
        self.service.create_order(product_id='p1', quantity=3)

        # Assert
        assert product.stock == 7
        self.order_repo.save.assert_called_once()

    def test_create_order_raises_when_insufficient_stock(self):
        # Arrange
        product = MagicMock(id='p1', stock=2)
        self.product_repo.find_by_id.return_value = product

        # Act & Assert
        with pytest.raises(InsufficientStockError):
            self.service.create_order(product_id='p1', quantity=5)

    @pytest.mark.parametrize("quantity,expected_total", [
        (1, 50.0),
        (3, 150.0),
        (10, 500.0),
    ])
    def test_order_total_calculation(self, quantity, expected_total):
        product = MagicMock(price=50.0, stock=20)
        self.product_repo.find_by_id.return_value = product
        order = self.service.create_order(product_id='p1', quantity=quantity)
        assert order.total == expected_total
```

### Ferramentas Python
| Ferramenta | Uso |
|------------|-----|
| **pytest** | Test runner principal |
| **pytest-mock** | Integração com unittest.mock |
| **factory_boy** | Factories de objetos para testes |
| **freezegun** | Mockar data/hora |
| **httpx / respx** | Mockar requisições HTTP |
| **pytest-asyncio** | Testes assíncronos |

---

## Java / Kotlin — JUnit + Mockito

```java
// OrderServiceTest.java

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private OrderRepository orderRepository;

    @InjectMocks
    private OrderService orderService;

    @Test
    @DisplayName("should create order when stock is sufficient")
    void shouldCreateOrderWhenStockIsSufficient() {
        // Arrange
        Product product = new Product("p1", 10, BigDecimal.valueOf(50.0));
        when(productRepository.findById("p1")).thenReturn(Optional.of(product));

        // Act
        Order order = orderService.createOrder("p1", 3);

        // Assert
        assertThat(order.getTotal()).isEqualByComparingTo("150.00");
        verify(orderRepository).save(any(Order.class));
    }

    @Test
    @DisplayName("should throw InsufficientStockException when quantity exceeds stock")
    void shouldThrowWhenInsufficientStock() {
        Product product = new Product("p1", 2, BigDecimal.valueOf(50.0));
        when(productRepository.findById("p1")).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> orderService.createOrder("p1", 5))
            .isInstanceOf(InsufficientStockException.class);
    }
}
```

---

## Fake vs Mock — quando usar cada um

```typescript
// ❌ Teste frágil com Mock — testa implementação
it('should save user', () => {
  userRepository.save = jest.fn()
  userService.createUser(dto)
  expect(userRepository.save).toHaveBeenCalledWith(...)
  // Se mudar a implementação interna, o teste quebra
})

// ✅ Teste robusto com Fake — testa comportamento
class InMemoryUserRepository implements UserRepository {
  private users: User[] = []
  async save(user: User) { this.users.push(user) }
  async findByEmail(email: string) { return this.users.find(u => u.email === email) }
  async findAll() { return this.users }
}

it('should create user in repository', async () => {
  const repo = new InMemoryUserRepository()
  const service = new UserService(repo)
  await service.createUser(dto)
  const users = await repo.findAll()
  expect(users).toHaveLength(1)
  // Se mudar a implementação, o teste continua válido
})
```
