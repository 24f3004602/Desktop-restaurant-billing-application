def auth_token(client):
    login = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert login.status_code == 200
    return login.json()["access_token"]


def auth_headers(client):
    return {"Authorization": f"Bearer {auth_token(client)}"}


def test_auth_me(client):
    headers = auth_headers(client)
    response = client.get("/api/v1/auth/me", headers=headers)

    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_create_order_bill_payment(client):
    headers = auth_headers(client)

    category = client.post(
        "/api/v1/categories",
        json={"name": "Integration-Cat", "display_order": 1, "is_active": True},
        headers=headers,
    )
    assert category.status_code == 201

    menu_item = client.post(
        "/api/v1/menu-items",
        json={
            "category_id": category.json()["id"],
            "name": "Integration-Item",
            "description": "integration",
            "price_cents": 10000,
            "gst_percent": 5,
            "is_available": True,
        },
        headers=headers,
    )
    assert menu_item.status_code == 201

    order = client.post(
        "/api/v1/orders",
        json={"table_id": None, "order_type": "takeaway", "notes": "integration"},
        headers=headers,
    )
    assert order.status_code == 201

    add_item = client.post(
        f"/api/v1/orders/{order.json()['id']}/items",
        json={"menu_item_id": menu_item.json()["id"], "quantity": 1, "special_note": None},
        headers=headers,
    )
    assert add_item.status_code == 200

    bill = client.post(
        f"/api/v1/billing/orders/{order.json()['id']}/bill",
        json={"discount_cents": 0},
        headers=headers,
    )
    assert bill.status_code == 200
    assert bill.json()["payment_status"] == "unpaid"

    payment = client.post(
        f"/api/v1/bills/{bill.json()['id']}/payments",
        json={"method": "cash", "amount_cents": bill.json()["grand_total_cents"], "reference_no": None},
        headers=headers,
    )
    assert payment.status_code == 201

    fetched_bill = client.get(f"/api/v1/billing/{bill.json()['id']}", headers=headers)
    assert fetched_bill.status_code == 200
    assert fetched_bill.json()["payment_status"] == "paid"
