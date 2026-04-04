# RRBEC Middleware - Guia de Integração (Electron/Desktop)

Este guia documenta como a aplicação Electron deve se comunicar com o servidor middleware local em Go.

## 1. Configurações Base
- **URL Base**: `http://localhost:8080/api/v1`
- **Porta Default**: `8080` (configurável no arquivo `.env` do servidor).
- **Formato**: Todas as requisições e respostas utilizam `application/json`.

## 2. Autenticação (SimpleAuth)
O servidor não utiliza tokens JWT complexos localmente. A autenticação funciona assim:
1. Faça login em `/login` enviando `username` e `password`.
2. O servidor retornará um objeto de usuário. Capture o valor do campo `id` (inteiro).
3. Envie esse valor no cabeçalho HTTP `X-User-ID` em todas as rotas marcadas como **[PROTEGIDO]**.

---

## 3. Endpoints da API

### [PÚBLICO] Login
**POST** `/login`
- **Body**: `{ "username": "seu_usuario", "password": "sua_senha" }`
- **Retorno**: Objeto User completo.

### [PÚBLICO] Listar Mesas
**GET** `/mesas`
- **Retorno**: Array de objetos mesas com `id`, `uuid`, `name`, `active`.

### [PÚBLICO] Listar Produtos/Estoque
**GET** `/products`
- **Retorno**: Array de produtos com preços e quantidade em estoque.

### [PÚBLICO] Listar Categorias
**GET** `/categories`

### [PÚBLICO] Listar Clientes
**GET** `/clients`

### [PÚBLICO] Listar Pedidos (Cozinha/Orders)
**GET** `/orders`

### [PÚBLICO] Listar Tipos de Pagamento
**GET** `/payment-types`

### [PÚBLICO] Listar Pagamentos Realizados
**GET** `/payments`

### [PÚBLICO] Ver Comanda por ID
**GET** `/comandas/:id` (Ex: `/api/v1/comandas/9`)
- **Retorno**: Detalhes da comanda.

---

## 4. Comandas e Itens (Ações)

### [PROTEGIDO] Abrir Nova Comanda
**POST** `/comandas`
- **Headers**: `X-User-ID: <id_do_usuario>`
- **Body**: `{ "mesa_id": 1, "client_id": null }`

### [PROTEGIDO] Lançar Pedido (Adicionar Item)
**POST** `/items-comanda`
- **Headers**: `X-User-ID: <id_do_usuario>`
- **Body**: `{ "comanda_id": 9, "product_id": 50, "applicant": "Nome do Garçom" }`

### [PROTEGIDO] Deletar Item Individual
**DELETE** `/items-comanda/:id`
- **Headers**: `X-User-ID: <id_do_usuario>`

### [PROTEGIDO] Limpar e Fechar Comanda (Apagar Inteira)
**POST** `/comandas/:id/apagar`
- **Headers**: `X-User-ID: <id_do_usuario>`
- **Efeito**: Remove todos os itens da comanda e muda o status para `CLOSED`.

### [PROTEGIDO] Pagar e Fechar Comanda
**POST** `/comandas/:id/pagar`
- **Headers**: `X-User-ID: <id_do_usuario>`
- **Body**:
  ```json
  {
      "value": 50.00,
      "type_pay_id": 1,
      "client_id": null
  }
  ```
- **Efeito**: Registra o pagamento localmente e fecha a comanda.
