from uuid import uuid4


def auth_token(client):
    login = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert login.status_code == 200
    return login.json()["access_token"]


def auth_tokens(client, username: str = "admin", password: str = "admin123"):
    login = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert login.status_code == 200
    body = login.json()
    assert body.get("access_token")
    assert body.get("refresh_token")
    return body


def auth_headers(client):
    return {"Authorization": f"Bearer {auth_token(client)}"}


def test_auth_me(client):
    headers = auth_headers(client)
    response = client.get("/api/v1/auth/me", headers=headers)

    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_create_order_bill_payment(client):
    headers = auth_headers(client)
    suffix = uuid4().hex[:8]

    category = client.post(
        "/api/v1/categories",
        json={"name": f"Integration-Cat-{suffix}", "display_order": 1, "is_active": True},
        headers=headers,
    )
    assert category.status_code == 201

    menu_item = client.post(
        "/api/v1/menu-items",
        json={
            "category_id": category.json()["id"],
            "name": f"Integration-Item-{suffix}",
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


def test_refresh_token_and_password_change(client):
    tokens = auth_tokens(client)

    refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert refresh.status_code == 200
    refreshed = refresh.json()
    assert refreshed.get("access_token")
    assert refreshed.get("refresh_token")

    headers = {"Authorization": f"Bearer {refreshed['access_token']}"}
    changed = client.patch(
        "/api/v1/users/me/password",
        json={"current_password": "admin123", "new_password": "admin12345"},
        headers=headers,
    )
    assert changed.status_code == 200

    old_login = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin12345"},
    )
    assert new_login.status_code == 200

    restore_headers = {"Authorization": f"Bearer {new_login.json()['access_token']}"}
    restored = client.patch(
        "/api/v1/users/me/password",
        json={"current_password": "admin12345", "new_password": "admin123"},
        headers=restore_headers,
    )
    assert restored.status_code == 200


def test_staff_management_create_update_and_deactivate(client):
    headers = auth_headers(client)
    suffix = uuid4().hex[:8]
    username = f"staff-{suffix}"

    created = client.post(
        "/api/v1/auth/users",
        json={
            "username": username,
            "full_name": "Staff Member",
            "password": "staffpass123",
            "role": "waiter",
        },
        headers=headers,
    )
    assert created.status_code == 201
    staff_user = created.json()

    patched = client.patch(
        f"/api/v1/auth/users/{staff_user['id']}",
        json={"role": "cashier", "is_active": False},
        headers=headers,
    )
    assert patched.status_code == 200
    assert patched.json()["role"] == "cashier"
    assert patched.json()["is_active"] is False

    inactive_login = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "staffpass123"},
    )
    assert inactive_login.status_code == 401

    reactivated = client.patch(
        f"/api/v1/auth/users/{staff_user['id']}",
        json={"is_active": True, "password": "staffpass456"},
        headers=headers,
    )
    assert reactivated.status_code == 200
    assert reactivated.json()["is_active"] is True

    active_login = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "staffpass456"},
    )
    assert active_login.status_code == 200

    users_list = client.get("/api/v1/auth/users", headers=headers)
    assert users_list.status_code == 200
    admin_user = next(user for user in users_list.json() if user["username"] == "admin")

    self_deactivate = client.patch(
        f"/api/v1/auth/users/{admin_user['id']}",
        json={"is_active": False},
        headers=headers,
    )
    assert self_deactivate.status_code == 400


def test_inventory_stock_depletion_and_restore(client):
    headers = auth_headers(client)
    suffix = uuid4().hex[:8]

    category = client.post(
        "/api/v1/categories",
        json={"name": f"Inventory-Cat-{suffix}", "display_order": 1, "is_active": True},
        headers=headers,
    )
    assert category.status_code == 201

    menu_item = client.post(
        "/api/v1/menu-items",
        json={
            "category_id": category.json()["id"],
            "name": f"Inventory-Item-{suffix}",
            "description": "inventory integration",
            "price_cents": 12000,
            "gst_percent": 5,
            "is_available": True,
            "track_inventory": True,
            "stock_quantity": 3,
            "low_stock_threshold": 1,
        },
        headers=headers,
    )
    assert menu_item.status_code == 201
    item_id = menu_item.json()["id"]

    order = client.post(
        "/api/v1/orders",
        json={"table_id": None, "order_type": "takeaway", "notes": "inventory test"},
        headers=headers,
    )
    assert order.status_code == 201
    order_id = order.json()["id"]

    added = client.post(
        f"/api/v1/orders/{order_id}/items",
        json={"menu_item_id": item_id, "quantity": 2, "special_note": None},
        headers=headers,
    )
    assert added.status_code == 200
    order_item_id = added.json()["items"][0]["id"]

    too_many = client.patch(
        f"/api/v1/orders/{order_id}/items/{order_item_id}",
        json={"quantity": 5},
        headers=headers,
    )
    assert too_many.status_code == 409

    increase_to_zero = client.patch(
        f"/api/v1/orders/{order_id}/items/{order_item_id}",
        json={"quantity": 3},
        headers=headers,
    )
    assert increase_to_zero.status_code == 200

    menu_items_after_depletion = client.get("/api/v1/menu-items", headers=headers)
    assert menu_items_after_depletion.status_code == 200
    depleted_item = next(item for item in menu_items_after_depletion.json() if item["id"] == item_id)
    assert depleted_item["stock_quantity"] == 0
    assert depleted_item["is_available"] is False

    removed = client.delete(
        f"/api/v1/orders/{order_id}/items/{order_item_id}",
        headers=headers,
    )
    assert removed.status_code == 200

    menu_items_after_restore = client.get("/api/v1/menu-items", headers=headers)
    assert menu_items_after_restore.status_code == 200
    restored_item = next(item for item in menu_items_after_restore.json() if item["id"] == item_id)
    assert restored_item["stock_quantity"] == 3
    assert restored_item["is_available"] is True
