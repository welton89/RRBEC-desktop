# Guia de Teste da API com Postman

Este documento explica como testar os endpoints da API do sistema **Gestão Raul** utilizando o Postman.

---

## 1. Passo 1: Obter o Token de Acesso (Login)

Como a API é protegida, você precisa primeiro de um token de autorização.

1.  Abra o **Postman** e crie uma nova aba de requisição.
2.  Mude o método para **POST**.
3.  Coloque a URL: `http://localhost:8000/api/v1/token/`
4.  Vá na aba **Body**, selecione a opção **raw** e escolha **JSON** no menu à direita.
5.  Insira suas credenciais no formato abaixo:
    ```json
    {
        "username": "seu_usuario_django",
        "password": "sua_senha_django"
    }
    ```
6.  Clique em **Send**.
7.  No resultado (JSON), copie o código que aparece no campo `"access"`.

---

## 2. Passo 2: Acessar os Endpoints da API

Agora que você tem o token, pode acessar qualquer endpoint protegido (ex: Pedidos).

1.  Crie uma nova aba de requisição no Postman.
2.  Mude o método para **GET**.
3.  Coloque a URL do endpoint que deseja testar, por exemplo:
    `http://localhost:8000/api/v1/orders/`
4.  Vá na aba **Authorization** (fica logo abaixo da URL).
5.  No campo **Type**, selecione **Bearer Token**.
6.  No campo **Token** (à direita), cole o código `"access"` que você copiou no Passo 1.
7.  Clique em **Send**.

Você deverá ver a lista de dados em formato JSON.

---

## Dicas Rápidas
- **Erro 401 Unauthorized:** Significa que o token não foi enviado corretamente ou expirou. Obtenha um novo no Passo 1.
- **CORS:** O backend está configurado para aceitar requisições de outras origens (CORS), permitindo que seu frontend se conecte normalmente.
- **Endpoints Disponíveis:**
    - `/api/v1/orders/` (Pedidos)
    - `/api/v1/products/` (Produtos)
    - `/api/v1/clients/` (Clientes)
    - `/api/v1/mesas/` (Mesas)
    - `/api/v1/comandas/` (Comandas)
    - `/api/v1/items-comanda/` (Itens de Comanda)
    - `/api/v1/categories/` (Categorias)
    - `/api/v1/payment-types/` (Tipos de Pagamento)
    - `/api/v1/payments/` (Registro de Pagamentos)
