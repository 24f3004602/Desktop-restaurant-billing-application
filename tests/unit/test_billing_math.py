from types import SimpleNamespace

from app.modules.billing.service import compute_order_totals
from app.modules.payments.service import calculate_remaining_amount


def test_compute_order_totals_with_discount():
    items = [
        SimpleNamespace(line_subtotal_cents=10000, line_tax_cents=500),
        SimpleNamespace(line_subtotal_cents=5000, line_tax_cents=250),
    ]

    subtotal, tax, discount, total = compute_order_totals(items, discount_cents=1000)

    assert subtotal == 15000
    assert tax == 750
    assert discount == 1000
    assert total == 14750


def test_calculate_remaining_amount():
    assert calculate_remaining_amount(10000, 3000) == 7000
    assert calculate_remaining_amount(10000, 10000) == 0
    assert calculate_remaining_amount(10000, 13000) == 0
